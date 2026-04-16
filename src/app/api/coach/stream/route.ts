import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
  isClaudeAvailable,
  streamClaude,
  stripPII,
} from "@/lib/anthropic";
import { COACH_CHAT_PROMPT, type UserContext } from "@/lib/prompts/coach-chat";

const BodySchema = z.object({
  message: z.string().min(1).max(500),
  sessionId: z.string().optional(),
});

// --- In-memory sliding-window rate limit (per user) ---
// Defense-in-depth, NOT a strong throttle: max 10 requests / 60s per user id.
// Module-scope Map survives within a single Node process; horizontal scaling
// would need Redis, but this blocks the common case (one user spamming one
// pod) without adding infra.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const prev = rateBuckets.get(userId) ?? [];
  const recent = prev.filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) {
    rateBuckets.set(userId, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(userId, recent);
  return true;
}

async function loadUserContext(projectId: string): Promise<UserContext> {
  const [project, venues, favorites, latestEstimate] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
    prisma.venue.findMany({
      where: { projectId },
      select: { name: true, status: true },
    }),
    prisma.venueFavorite.findMany({
      where: { venue: { projectId } },
      include: { venue: { select: { name: true } } },
    }),
    prisma.estimate.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { venue: { select: { name: true } } },
    }),
  ]);

  return {
    conditions: project?.conditions as Record<string, unknown> | null,
    venues: venues.map((v) => ({ name: v.name, status: v.status })),
    favorites: favorites.map((f) => f.venue.name),
    latestEstimate: latestEstimate
      ? { venueName: latestEstimate.venue.name, total: latestEstimate.total }
      : null,
  };
}

/** Generates a session title from the first user message (up to 20 chars). */
function generateSessionTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  return trimmed.length > 20 ? trimmed.slice(0, 20) + "…" : trimmed;
}

/** Ensures a session exists, returning its id. Creates one if absent. */
async function ensureSession(
  projectId: string,
  sessionId: string | undefined,
  firstMessage: string,
): Promise<string> {
  if (sessionId) {
    const existing = await prisma.coachSession.findFirst({
      where: { id: sessionId, projectId },
      select: { id: true, title: true },
    });
    if (existing) {
      if (!existing.title) {
        await prisma.coachSession.update({
          where: { id: sessionId },
          data: { title: generateSessionTitle(firstMessage) },
        });
      }
      return sessionId;
    }
  }
  const session = await prisma.coachSession.create({
    data: { projectId, title: generateSessionTitle(firstMessage) },
    select: { id: true },
  });
  return session.id;
}

export async function POST(request: NextRequest) {
  if (!isClaudeAvailable()) {
    return NextResponse.json(
      { error: "Claude API is not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "メッセージは1〜500文字で入力してください。" },
      { status: 400 },
    );
  }
  const { message, sessionId: requestedSessionId } = parsed.data;

  const user = await requireUser();

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      {
        error:
          "短時間に多くのリクエストが送られました。少し時間を空けてお試しください。",
      },
      { status: 429 },
    );
  }

  const { projectId } = await requireProjectMembership(user.id);

  const resolvedSessionId = await ensureSession(projectId, requestedSessionId, message);

  const context = await loadUserContext(projectId);

  // Load last 20 messages from this session for Claude context
  const history = await prisma.coachMessage.findMany({
    where: { sessionId: resolvedSessionId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const historyAsc = history.reverse();

  // Persist the user message BEFORE the stream starts so it's visible in
  // history if the client reconnects mid-stream.
  const userMessageRow = await prisma.coachMessage.create({
    data: { projectId, sessionId: resolvedSessionId, role: "user", content: message },
    select: { id: true },
  });

  const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...historyAsc.map((m) => ({
      role: m.role as "user" | "assistant",
      content: stripPII(m.content),
    })),
    { role: "user" as const, content: stripPII(message) },
  ];

  let textStream: ReadableStream<string>;
  try {
    textStream = await streamClaude({
      system: COACH_CHAT_PROMPT.buildSystemPrompt(context),
      messages: claudeMessages,
      model: "claude-sonnet-4-6",
      maxTokens: 2048,
    });
  } catch (error) {
    await prisma.coachMessage
      .delete({ where: { id: userMessageRow.id } })
      .catch(() => {});
    const errMsg = error instanceof Error ? error.message : "stream init failed";
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  const isNewSession = !requestedSessionId || requestedSessionId !== resolvedSessionId;

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      // If a new session was created, send its id as the first frame
      if (isNewSession) {
        const sessionFrame = JSON.stringify({ sessionId: resolvedSessionId });
        controller.enqueue(encoder.encode(`data: ${sessionFrame}\n\n`));
      }

      let assembled = "";
      const reader = textStream.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          assembled += value;
          const payload = JSON.stringify({ text: value });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "stream error";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ error: errMsg })}\n\n`,
          ),
        );
      } finally {
        controller.close();
        if (assembled.trim().length === 0) {
          console.error(
            "[coach/stream] claude stream produced 0 chars — likely SDK event shape mismatch or upstream error",
            { projectId, sessionId: resolvedSessionId },
          );
        }
        if (assembled.trim().length > 0) {
          prisma.coachMessage
            .create({
              data: {
                projectId,
                sessionId: resolvedSessionId,
                role: "assistant",
                content: stripPII(assembled),
                metadata: { model: "claude-sonnet-4-6" },
              },
            })
            .then(() =>
              prisma.coachSession.update({
                where: { id: resolvedSessionId },
                data: { updatedAt: new Date() },
              }),
            )
            .then(() => {
              // Invalidate the Server Component cache so the client's
              // router.refresh() after the stream picks up the persisted
              // messages (prevents the 'typing bubble vanishes without a
              // reply' symptom).
              revalidatePath("/coach");
            })
            .catch((err) => {
              console.error("[coach/stream] Failed to persist assistant message:", err);
            });
        } else {
          // Claude returned nothing — still refresh so the user message
          // persisted at the start of the stream is visible in history.
          revalidatePath("/coach");
        }
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
