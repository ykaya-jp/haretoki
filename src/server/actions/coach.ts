"use server";

import { prisma } from "@/server/db";
import { revalidateTag, cacheTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, stripPII, withRetry } from "@/lib/anthropic";
import { parseConditions } from "@/lib/schemas";
import { COACH_CHAT_PROMPT, type UserContext } from "@/lib/prompts/coach-chat";
import { captureError } from "@/lib/sentry";

interface CoachResponse {
  answer: string;
  suggestedActions: Array<{ label: string; href: string }>;
  matched: boolean;
}

const FAQ_PATTERNS: Array<{
  keywords: string[];
  answer: string;
  actions: Array<{ label: string; href: string }>;
}> = [
  {
    keywords: ["見積もり", "費用", "予算", "いくら", "値段", "金額"],
    answer: "見積もりは初期額から平均で+84〜110万円上がると言われています。各式場の見積もりを入力すると、上がりやすい項目をAIが分析します。",
    actions: [{ label: "見積もりを見る", href: "/explore" }],
  },
  {
    keywords: ["比較", "どっち", "どちら", "違い", "選べない"],
    answer: "比較ボードで候補の式場を並べて見てみましょう。6つの評価軸でスコアを比較できます。",
    actions: [{ label: "比べる", href: "/candidates?tab=compare" }],
  },
  {
    keywords: ["見学", "ブライダルフェア", "フェア", "予約"],
    answer: "見学は2〜3箇所がおすすめです。事前にチェックリストを準備しておくと、見学中に大事なポイントを見逃しません。",
    actions: [{ label: "式場を見る", href: "/explore" }],
  },
  {
    keywords: ["パートナー", "彼", "彼女", "相手", "二人"],
    answer: "パートナーを招待すると、お互いの評価を比較できます。意見が分かれているポイントが一目でわかります。",
    actions: [{ label: "招待する", href: "/" }],
  },
  {
    keywords: ["決め", "決定", "最終", "選ぶ"],
    answer: "候補の式場を比較して、二人で納得できたら「この式場に決める」ボタンで決定できます。決め手の理由も記録できますよ。",
    actions: [{ label: "候補を見る", href: "/candidates?tab=decision" }],
  },
];

const FALLBACK_RESPONSE: CoachResponse = {
  answer: "ご質問ありがとうございます。現在は定型の回答のみ対応しています。式場選びに関する具体的なご質問（見積もり、比較、見学など）をお試しください。",
  suggestedActions: [
    { label: "見積もりについて", href: "/coach" },
    { label: "比較について", href: "/coach" },
  ],
  matched: false,
};

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
    conditions: parseConditions(project?.conditions),
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

/** Creates a new CoachSession and returns its id. */
export async function createCoachSession(firstMessage: string): Promise<{ id: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const session = await prisma.coachSession.create({
    data: {
      projectId,
      title: generateSessionTitle(firstMessage),
    },
    select: { id: true },
  });

  // W16-5: tag-based invalidation. revalidatePath("/coach") rebuilt the
  // entire route tree on every send; tagged cache lets the session list
  // and message stream invalidate independently.
  revalidateTag(`coach-sessions:${projectId}`, { expire: 0 });
  return { id: session.id };
}

export interface SessionListItem {
  id: string;
  title: string | null;
  updatedAt: Date;
  preview: string;
}

/** Lists all sessions for the current project, ordered by updatedAt desc. */
export async function listCoachSessions(): Promise<SessionListItem[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return listCoachSessionsCached(projectId);
}

async function listCoachSessionsCached(projectId: string): Promise<SessionListItem[]> {
  "use cache";
  cacheTag(`coach-sessions:${projectId}`);

  const sessions = await prisma.coachSession.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt,
    preview: s.messages[0]?.content?.slice(0, 30) ?? "",
  }));
}

export interface SessionDetail {
  session: { id: string; title: string | null; createdAt: Date; updatedAt: Date };
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: Date }>;
}

/** Gets a single session with its messages. */
export async function getCoachSession(sessionId: string): Promise<SessionDetail | null> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return getCoachSessionCached(sessionId, projectId);
}

async function getCoachSessionCached(
  sessionId: string,
  projectId: string,
): Promise<SessionDetail | null> {
  "use cache";
  cacheTag(`coach-session:${sessionId}`);
  cacheTag(`coach-sessions:${projectId}`);

  const session = await prisma.coachSession.findFirst({
    where: { id: sessionId, projectId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 100,
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!session) return null;

  return {
    session: {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt,
    })),
  };
}

/** Renames a session title. */
export async function renameCoachSession(sessionId: string, title: string): Promise<void> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  await prisma.coachSession.updateMany({
    where: { id: sessionId, projectId },
    data: { title: title.trim().slice(0, 100) },
  });

  revalidateTag(`coach-sessions:${projectId}`, { expire: 0 });
  revalidateTag(`coach-session:${sessionId}`, { expire: 0 });
}

/** Deletes a session and all its messages (cascade). */
export async function deleteCoachSession(sessionId: string): Promise<void> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  await prisma.coachSession.deleteMany({
    where: { id: sessionId, projectId },
  });

  revalidateTag(`coach-sessions:${projectId}`, { expire: 0 });
  revalidateTag(`coach-session:${sessionId}`, { expire: 0 });
}

/**
 * Idempotent user-message persist within a session.
 * Skips the insert if the most-recent message in the session is already this
 * exact user turn written within the last 60s.
 */
async function persistUserMessageIdempotent(
  projectId: string,
  sessionId: string,
  message: string,
) {
  const latest = await prisma.coachMessage.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: { role: true, content: true, createdAt: true },
  });
  const now = Date.now();
  if (
    latest &&
    latest.role === "user" &&
    latest.content === message &&
    now - latest.createdAt.getTime() < 60_000
  ) {
    return; // already persisted by stream route; skip duplicate
  }
  await prisma.coachMessage.create({
    data: { projectId, sessionId, role: "user", content: message },
  });
}

/** Ensures a session exists, creating one if sessionId is absent. */
async function ensureSession(
  projectId: string,
  sessionId: string | undefined,
  firstMessage: string,
): Promise<string> {
  if (sessionId) {
    // Validate session belongs to this project
    const existing = await prisma.coachSession.findFirst({
      where: { id: sessionId, projectId },
      select: { id: true, title: true },
    });
    if (existing) {
      // Set title from first user message if still unset
      if (!existing.title) {
        await prisma.coachSession.update({
          where: { id: sessionId },
          data: { title: generateSessionTitle(firstMessage) },
        });
      }
      return sessionId;
    }
  }
  // Create a new session
  const session = await prisma.coachSession.create({
    data: { projectId, title: generateSessionTitle(firstMessage) },
    select: { id: true },
  });
  return session.id;
}

export async function sendCoachMessage(
  message: string,
  sessionId?: string,
): Promise<CoachResponse & { sessionId: string }> {
  if (!message || message.length > 500) {
    return {
      answer: "メッセージは1〜500文字で入力してください。",
      suggestedActions: [],
      matched: false,
      sessionId: sessionId ?? "",
    };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const resolvedSessionId = await ensureSession(projectId, sessionId, message);

  // R2: Use Claude API if available
  if (isClaudeAvailable()) {
    const context = await loadUserContext(projectId);

    // Load last 20 messages from this session for context
    const history = await prisma.coachMessage.findMany({
      where: { sessionId: resolvedSessionId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const historyText =
      history.length > 0
        ? "\n\n## 最近の会話履歴:\n" +
          history
            .reverse()
            .map((m) => `${m.role === "user" ? "ユーザー" : "コーチ"}: ${stripPII(m.content)}`)
            .join("\n")
        : "";

    // Save user message (idempotent — no-op if stream route already saved it)
    await persistUserMessageIdempotent(projectId, resolvedSessionId, message);

    try {
      const response = await withRetry(() =>
        askClaude({
          system: COACH_CHAT_PROMPT.buildSystemPrompt(context),
          userMessage: stripPII(message) + historyText,
          model: "claude-sonnet-4-6",
          maxTokens: 2048,
        }),
      );

      await prisma.coachMessage.create({
        data: {
          projectId,
          sessionId: resolvedSessionId,
          role: "assistant",
          content: stripPII(response),
          metadata: { model: "claude-sonnet-4-6" },
        },
      });

      // Touch session updatedAt
      await prisma.coachSession.update({
        where: { id: resolvedSessionId },
        data: { updatedAt: new Date() },
      });

      revalidateTag(`coach-session:${resolvedSessionId}`, { expire: 0 });
      revalidateTag(`coach-sessions:${projectId}`, { expire: 0 });
      return { answer: response, suggestedActions: [], matched: true, sessionId: resolvedSessionId };
    } catch (err) {
      captureError(err, { action: "sendCoachMessage" });
      const faqResult = await matchFAQ(message, projectId, resolvedSessionId);
      return { ...faqResult, sessionId: resolvedSessionId };
    }
  }

  // Fallback: keyword matching
  try {
    await persistUserMessageIdempotent(projectId, resolvedSessionId, message);
  } catch {
    // Swallow — response still returned below
  }
  const faqResult = await matchFAQ(message, projectId, resolvedSessionId);
  return { ...faqResult, sessionId: resolvedSessionId };
}

async function matchFAQ(
  message: string,
  projectId: string,
  sessionId: string,
): Promise<CoachResponse> {
  const normalizedMessage = message.toLowerCase();
  const matchedFaq = FAQ_PATTERNS.find((faq) =>
    faq.keywords.some((keyword) => normalizedMessage.includes(keyword)),
  );

  const response: CoachResponse = matchedFaq
    ? { answer: matchedFaq.answer, suggestedActions: matchedFaq.actions, matched: true }
    : FALLBACK_RESPONSE;

  try {
    await prisma.coachMessage.create({
      data: {
        projectId,
        sessionId,
        role: "assistant",
        content: response.answer,
        metadata: { source: "faq", matched: response.matched },
      },
    });
    // Touch session updatedAt
    await prisma.coachSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
  } catch {
    // Swallow DB errors — UI still gets a response from the return value
  }

  revalidateTag(`coach-session:${sessionId}`, { expire: 0 });
  revalidateTag(`coach-sessions:${projectId}`, { expire: 0 });
  return response;
}

export async function getCoachHistory(sessionId?: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  return getCoachHistoryCached(projectId, sessionId);
}

async function getCoachHistoryCached(projectId: string, sessionId?: string) {
  "use cache";
  cacheTag(`coach-sessions:${projectId}`);
  if (sessionId) cacheTag(`coach-session:${sessionId}`);

  const where = sessionId ? { sessionId, projectId } : { projectId };

  const messages = await prisma.coachMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return messages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt,
  }));
}
