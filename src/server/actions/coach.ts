"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, askClaude, stripPII, withRetry } from "@/lib/anthropic";
import { COACH_CHAT_PROMPT, type UserContext } from "@/lib/prompts/coach-chat";

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
    actions: [{ label: "比較する", href: "/candidates" }],
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
    actions: [{ label: "候補を見る", href: "/candidates" }],
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
    conditions: project?.conditions as Record<string, unknown> | null,
    venues: venues.map((v) => ({ name: v.name, status: v.status })),
    favorites: favorites.map((f) => f.venue.name),
    latestEstimate: latestEstimate
      ? { venueName: latestEstimate.venue.name, total: latestEstimate.total }
      : null,
  };
}

export async function sendCoachMessage(message: string): Promise<CoachResponse> {
  if (!message || message.length > 500) {
    return { answer: "メッセージは1〜500文字で入力してください。", suggestedActions: [], matched: false };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // R2: Use Claude API if available
  if (isClaudeAvailable()) {
    const context = await loadUserContext(projectId);

    // Load conversation history (last 20 messages)
    const history = await prisma.coachMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Build conversation context
    const historyText = history.length > 0
      ? "\n\n## 最近の会話履歴:\n" + history.reverse().map(m =>
          `${m.role === "user" ? "ユーザー" : "コーチ"}: ${m.content}`
        ).join("\n")
      : "";

    // Save user message
    await prisma.coachMessage.create({
      data: { projectId, role: "user", content: message },
    });

    try {
      const response = await withRetry(() =>
        askClaude({
          system: COACH_CHAT_PROMPT.buildSystemPrompt(context),
          userMessage: stripPII(message) + historyText,
          maxTokens: 2048,
        })
      );

      // Save assistant response
      await prisma.coachMessage.create({
        data: {
          projectId,
          role: "assistant",
          content: response,
          metadata: { model: "claude-sonnet-4-6" },
        },
      });

      revalidatePath("/coach");
      return { answer: response, suggestedActions: [], matched: true };
    } catch {
      // Fallback to FAQ on Claude API failure
      return await matchFAQ(message, projectId);
    }
  }

  // Fallback: R1 keyword matching (no Claude API available)
  // Save user message so history view shows the turn
  try {
    await prisma.coachMessage.create({
      data: { projectId, role: "user", content: message },
    });
  } catch {
    // Swallow — response still returned below
  }
  return await matchFAQ(message, projectId);
}

async function matchFAQ(message: string, projectId: string): Promise<CoachResponse> {
  const normalizedMessage = message.toLowerCase();
  const matchedFaq = FAQ_PATTERNS.find((faq) =>
    faq.keywords.some((keyword) => normalizedMessage.includes(keyword))
  );

  const response: CoachResponse = matchedFaq
    ? { answer: matchedFaq.answer, suggestedActions: matchedFaq.actions, matched: true }
    : FALLBACK_RESPONSE;

  // Persist assistant reply to CoachMessage so UI history shows both user & assistant turns
  // (Previously only the Claude path wrote to CoachMessage; FAQ fallback left the user
  //  message orphaned, resulting in a broken conversation view.)
  try {
    await prisma.coachMessage.create({
      data: {
        projectId,
        role: "assistant",
        content: response.answer,
        metadata: { source: "faq", matched: response.matched },
      },
    });
  } catch {
    // Swallow DB errors — UI still gets a response from the return value
  }

  // Still save to AiAnalysis for backward compat (R1 pattern)
  // Note: We don't await this to avoid blocking the response
  prisma.aiAnalysis.create({
    data: {
      projectId,
      type: "coach_chat",
      output: JSON.stringify({ question: message, answer: response.answer }),
    },
  }).catch(() => {}); // fire and forget

  revalidatePath("/coach");
  return response;
}

export async function getCoachHistory() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // R2: Read from CoachMessage table
  const messages = await prisma.coachMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  if (messages.length > 0) {
    // R2 format: individual messages
    return messages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  // Fallback: Read from AiAnalysis (R1 format)
  const history = await prisma.aiAnalysis.findMany({
    where: { projectId, type: "coach_chat" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return history.flatMap((h) => {
    const parsed = JSON.parse(h.output) as { question?: string; answer?: string };
    const items: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: Date }> = [];
    if (parsed.question) items.push({ id: `${h.id}-q`, role: "user", content: parsed.question, createdAt: h.createdAt });
    if (parsed.answer) items.push({ id: `${h.id}-a`, role: "assistant", content: parsed.answer, createdAt: h.createdAt });
    return items;
  });
}
