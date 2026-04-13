"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

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

export async function sendCoachMessage(message: string): Promise<CoachResponse> {
  if (!message || message.length > 500) {
    return { answer: "メッセージは1〜500文字で入力してください。", suggestedActions: [], matched: false };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // FAQ keyword matching
  const normalizedMessage = message.toLowerCase();
  const matchedFaq = FAQ_PATTERNS.find((faq) =>
    faq.keywords.some((keyword) => normalizedMessage.includes(keyword))
  );

  const response: CoachResponse = matchedFaq
    ? { answer: matchedFaq.answer, suggestedActions: matchedFaq.actions, matched: true }
    : FALLBACK_RESPONSE;

  // Save to AiAnalysis for history
  await prisma.aiAnalysis.create({
    data: {
      projectId,
      type: "coach_chat",
      output: JSON.stringify({ question: message, answer: response.answer }),
    },
  });

  revalidatePath("/coach");
  return response;
}

export async function getCoachHistory() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const history = await prisma.aiAnalysis.findMany({
    where: { projectId, type: "coach_chat" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return history.map((h) => {
    const parsed = JSON.parse(h.output) as { question?: string; answer?: string };
    return {
      id: h.id,
      question: parsed.question ?? "",
      answer: parsed.answer ?? "",
      createdAt: h.createdAt,
    };
  });
}
