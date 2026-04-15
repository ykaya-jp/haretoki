/**
 * E-6 Money Reality Check — 静的ルール
 *
 * 業界統計 + Haretoki 内部知識で、見積もり明細の「抜け」「上がりやすい」
 * を検知する。Claude 呼び出しを使わず 0 コストで常時表示可能。
 *
 * 数字ソース:
 *  - ブライダル総研 2023-24 年度レポート
 *  - ゼクシィ結婚トレンド調査 2024
 *  - Haretoki 内部 Review.estimateIncrease 集計
 */

export interface MissingRule {
  key: string;
  label: string;
  typicalAmount: number; // yen
  /** ざっくりのキーワード群 — 既存明細に含まれていれば「抜け」ではないと判定 */
  nameHints: string[];
  /** UI での並び順（低=先頭） */
  sort: number;
}

export const COMMON_MISSING_ITEMS: readonly MissingRule[] = [
  {
    key: "dress-bringin-fee",
    label: "ドレス持込料",
    typicalAmount: 100_000,
    nameHints: ["持込", "持ち込み", "ブリング"],
    sort: 10,
  },
  {
    key: "weekend-surcharge",
    label: "土日・祝日追加料金",
    typicalAmount: 300_000,
    nameHints: ["土日", "祝日", "休日"],
    sort: 20,
  },
  {
    key: "cancellation",
    label: "キャンセル料の明記",
    typicalAmount: 0,
    nameHints: ["キャンセル"],
    sort: 30,
  },
  {
    key: "dress-2nd",
    label: "ドレス 2 着目",
    typicalAmount: 150_000,
    nameHints: ["ドレス2", "ドレス 2", "2着", "2 着", "カラードレス"],
    sort: 40,
  },
  {
    key: "groom-attire",
    label: "新郎衣装",
    typicalAmount: 80_000,
    nameHints: ["新郎", "タキシード", "紋服", "モーニング"],
    sort: 50,
  },
  {
    key: "flower-upgrade",
    label: "装花ランクアップ余地",
    typicalAmount: 150_000,
    nameHints: ["装花", "フラワー", "ブーケ"],
    sort: 60,
  },
  {
    key: "photo-album",
    label: "写真アルバム",
    typicalAmount: 150_000,
    nameHints: ["アルバム", "フォトブック", "写真集"],
    sort: 70,
  },
  {
    key: "video",
    label: "ビデオ撮影",
    typicalAmount: 150_000,
    nameHints: ["ビデオ", "映像", "ムービー"],
    sort: 80,
  },
  {
    key: "welcome-drink",
    label: "ウェルカムドリンク",
    typicalAmount: 30_000,
    nameHints: ["ウェルカムドリンク", "ウェルカム"],
    sort: 90,
  },
] as const;

export interface UpgradeRiskRule {
  key: string;
  label: string;
  baseRate: number; // 0-1
  avgDeltaYen: number;
  /** 該当 EstimateItem を判定するキーワード */
  keywords: string[];
}

export const UPGRADE_RISK_RULES: readonly UpgradeRiskRule[] = [
  {
    key: "attire-upgrade",
    label: "衣装",
    baseRate: 0.62,
    avgDeltaYen: 250_000,
    keywords: ["衣装", "ドレス", "タキシード", "attire"],
  },
  {
    key: "cuisine-upgrade",
    label: "料理",
    baseRate: 0.65,
    avgDeltaYen: 200_000,
    keywords: ["料理", "コース", "cuisine", "food"],
  },
  {
    key: "flowers-upgrade",
    label: "装花",
    baseRate: 0.45,
    avgDeltaYen: 150_000,
    keywords: ["装花", "フラワー", "flower", "ブーケ"],
  },
  {
    key: "photo-upgrade",
    label: "写真・映像",
    baseRate: 0.5,
    avgDeltaYen: 250_000,
    keywords: ["写真", "映像", "ビデオ", "photo", "video", "撮影"],
  },
  {
    key: "paper-upgrade",
    label: "ペーパーアイテム",
    baseRate: 0.3,
    avgDeltaYen: 80_000,
    keywords: ["招待状", "ペーパー", "席次", "paper", "stationery"],
  },
] as const;

export interface NegotiationTip {
  key: string;
  title: string;
  summary: string;
  script: string;
}

/** 静的交渉ヒント。Claude を使わなくても最低 3 件提供可能 */
export const STATIC_NEGOTIATION_TIPS: readonly NegotiationTip[] = [
  {
    key: "off-season",
    title: "繁忙期を外す提案",
    summary:
      "4 月・10 月・11 月は繁忙期。1-2 月・7-8 月に動かすと総額 10-15% 下がる傾向があります。",
    script:
      "「仕事の都合で 2 月も選択肢に入れています。その場合、金額はどのくらい変わりますか？」",
  },
  {
    key: "other-venues",
    title: "他社比較の明示",
    summary:
      "他式場と並行検討中であることを伝えると、10-30 万の値引き or グレードアップ提案が出やすい傾向です。",
    script:
      "「別の式場とも検討中で、あとはこちら様の見積もりの調整次第という状況です。ご相談いただける余地はありますか？」",
  },
  {
    key: "bringin",
    title: "持込みの相談",
    summary:
      "ドレス持込料 10 万が想定ですが、3 着以上の場合は減免交渉できる式場があります。",
    script:
      "「他で気に入ったドレスがあって、持込の可能性があります。3 着目以降のご相談をしたいのですが、減免の余地はありますか？」",
  },
] as const;

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** 明細に `label` 相当の項目が含まれているか */
function itemIncluded(itemName: string, hints: string[]): boolean {
  const n = normalize(itemName);
  return hints.some((h) => n.includes(normalize(h)));
}

export function detectMissingItems<T extends { itemName: string }>(
  items: T[],
): MissingRule[] {
  return COMMON_MISSING_ITEMS.filter(
    (rule) => !items.some((i) => itemIncluded(i.itemName, rule.nameHints)),
  ).sort((a, b) => a.sort - b.sort);
}

export function detectUpgradeRisks<T extends { itemName: string }>(
  items: T[],
): UpgradeRiskRule[] {
  return UPGRADE_RISK_RULES.filter((rule) =>
    items.some((i) => itemIncluded(i.itemName, rule.keywords)),
  );
}
