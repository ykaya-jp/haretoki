import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
  isClaudeAvailable,
  streamClaude,
  stripPII,
} from "@/lib/anthropic";
import { COACH_CHAT_PROMPT, type UserContext } from "@/lib/prompts/coach-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().min(1).max(500),
});

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
  const { message } = parsed.data;

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const context = await loadUserContext(projectId);

  // Load last 20 messages (excluding the one we're about to save) for context.
  const history = await prisma.coachMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const historyAsc = history.reverse();

  // Persist the user message BEFORE the stream starts so it's visible in
  // history if the client reconnects mid-stream. We also capture the new row's
  // id so we can roll it back if streamClaude() throws before any bytes are
  // emitted (otherwise the client's fallback to sendCoachMessage would create
  // a duplicate user turn).
  const userMessageRow = await prisma.coachMessage.create({
    data: { projectId, role: "user", content: message },
    select: { id: true },
  });

  // Build Claude messages array: prior history + new user message.
  // stripPII is applied to EVERY message (not just the new one) so emails/
  // phones captured in earlier turns never leak to Anthropic on replay.
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
      maxTokens: 2048,
    });
  } catch (error) {
    // Stream never started — roll back the user message so the client's
    // fallback (sendCoachMessage) can re-persist without duplicating.
    await prisma.coachMessage
      .delete({ where: { id: userMessageRow.id } })
      .catch(() => {});
    const errMsg = error instanceof Error ? error.message : "stream init failed";
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assembled = "";
      const reader = textStream.getReader();
      try {
        // Stream chunks as SSE `data:` events.
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          assembled += value;
          // Escape newlines so SSE framing isn't broken — client decodes JSON.
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
        // Persist assistant response (fire-and-forget; don't block stream close).
        // stripPII applied so Claude-echoed PII isn't persisted.
        if (assembled.trim().length > 0) {
          prisma.coachMessage
            .create({
              data: {
                projectId,
                role: "assistant",
                content: stripPII(assembled),
                metadata: { model: "claude-sonnet-4-6" },
              },
            })
            .catch(() => {
              // best-effort persistence; client will see content either way
            });
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
