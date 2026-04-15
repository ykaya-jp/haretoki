/**
 * E-8 Question Bank — 見学当日に聞くこと 10 問
 *
 * Static, deterministic. 式場タイプや条件に応じて軽くカスタマイズするが
 * Claude 呼び出しは不要 (v1)。カテゴリ毎に必須 10 問を提供する。
 */

export interface VisitQuestionSeed {
  item: string;
  category: string;
  sortOrder: number;
}

/** 必須 10 問: 費用・スケジュール・運用の 3 軸をカバー */
const BASE_QUESTIONS: VisitQuestionSeed[] = [
  {
    item: "最終見積もりの提示タイミングは何ヶ月前になりますか？",
    category: "費用",
    sortOrder: 10,
  },
  {
    item: "ドレス 2 着目・新郎衣装の持込料はいくらですか？",
    category: "費用",
    sortOrder: 20,
  },
  {
    item: "土日・繁忙期の追加料金はどのくらい違いますか？",
    category: "費用",
    sortOrder: 30,
  },
  {
    item: "キャンセル料の発生時期と金額規定を教えてください。",
    category: "契約",
    sortOrder: 40,
  },
  {
    item: "支払い方法(カード/現金/分割)と時期を教えてください。",
    category: "契約",
    sortOrder: 50,
  },
  {
    item: "写真・映像の外部手配は可能ですか？その場合の持込料は？",
    category: "運用",
    sortOrder: 60,
  },
  {
    item: "雨天時の挙式・撮影の代替プランはありますか？",
    category: "運用",
    sortOrder: 70,
  },
  {
    item: "控室・新婦更衣室の広さと利用可能時間を教えてください。",
    category: "設備",
    sortOrder: 80,
  },
  {
    item: "アレルギー・特別食への対応はどこまで可能ですか？",
    category: "料理",
    sortOrder: 90,
  },
  {
    item: "プランナーの担当変更はありますか？その場合の連絡体制は？",
    category: "スタッフ",
    sortOrder: 100,
  },
];

/**
 * 式場特性に応じた追加質問 (任意で差し込む)。
 */
function contextualExtras(args: {
  hasOutdoor?: boolean;
  hasShintoStyle?: boolean;
  guestCountLarge?: boolean;
}): VisitQuestionSeed[] {
  const extras: VisitQuestionSeed[] = [];
  if (args.hasOutdoor) {
    extras.push({
      item: "屋外演出の場合、音量規制や終了時刻の制限はありますか？",
      category: "演出",
      sortOrder: 75,
    });
  }
  if (args.hasShintoStyle) {
    extras.push({
      item: "神前式の場合、親族以外の参列は可能ですか？",
      category: "挙式",
      sortOrder: 76,
    });
  }
  if (args.guestCountLarge) {
    extras.push({
      item: "ゲスト送迎バスの手配は可能ですか？費用目安は？",
      category: "運用",
      sortOrder: 77,
    });
  }
  return extras;
}

export function buildVisitQuestions(context: {
  ceremonyStyles?: string[];
  capacityMax?: number | null;
  hasGarden?: boolean;
}): VisitQuestionSeed[] {
  const hasShintoStyle = (context.ceremonyStyles ?? []).some((s) =>
    /神前|仏前|shinto/i.test(s),
  );
  const hasOutdoor =
    context.hasGarden === true ||
    (context.ceremonyStyles ?? []).some((s) => /garden|チャペル|屋外/i.test(s));
  const guestCountLarge = (context.capacityMax ?? 0) >= 100;

  const extras = contextualExtras({ hasOutdoor, hasShintoStyle, guestCountLarge });
  return [...BASE_QUESTIONS, ...extras].sort((a, b) => a.sortOrder - b.sortOrder);
}
