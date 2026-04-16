export const TIER1_DIMENSIONS = [
  "ceremony_space",
  "banquet_space",
  "cuisine",
  "attire_items",
  "hospitality",
  "cost_contract",
  "logistics",
  "overall",
] as const;

export type Tier1Dimension = (typeof TIER1_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<string, string> = {
  ceremony_space: "挙式会場",
  banquet_space: "披露宴会場",
  cuisine: "料理・飲み物",
  attire_items: "衣裳・アイテム",
  hospitality: "スタッフ・対応",
  cost_contract: "費用・契約",
  logistics: "利便性・設備",
  overall: "総合印象",
  // Legacy keys (kept for existing VenueScore data compatibility)
  atmosphere: "雰囲気",
  cost: "費用",
  access: "アクセス",
  reviews: "総合印象",
  dress: "衣裳",
  photo_video: "写真・映像",
  flowers: "装花",
  staff_continuity: "スタッフ",
  capacity: "収容人数",
  cancellation: "キャンセル",
};

export const DIMENSION_HELP: Record<string, string> = {
  ceremony_space: "チャペルや挙式スペースの雰囲気・演出",
  banquet_space: "披露宴会場のレイアウト・装飾・演出設備",
  cuisine: "料理の味・柔軟性、ドリンク、ケーキ",
  attire_items: "衣裳、アクセサリー、ペーパーアイテム",
  hospitality: "プランナーやスタッフの対応品質",
  cost_contract: "見積もり内容・支払い条件・キャンセル料",
  logistics: "収容人数・動線・設備・日取り・アクセス",
  overall: "全体を通しての満足度",
};

export const LEGACY_DIMENSION_MAP: Record<string, Tier1Dimension> = {
  atmosphere: "ceremony_space",
  access: "logistics",
  cost: "cost_contract",
  reviews: "overall",
  // These old keys map to their closest new equivalent
  dress: "attire_items",
  staff_continuity: "hospitality",
  capacity: "logistics",
  cancellation: "cost_contract",
  flowers: "banquet_space",
  photo_video: "ceremony_space",
};

export const NEW_TO_DB_DIMENSION: Record<Tier1Dimension, string> = {
  ceremony_space: "ceremony_space",
  banquet_space: "banquet_space",
  cuisine: "cuisine",
  attire_items: "attire_items",
  hospitality: "hospitality",
  cost_contract: "cost_contract",
  logistics: "logistics",
  overall: "overall",
};

export const SCORE_COLORS = {
  high: "text-success",
  medium: "text-accent",
  low: "text-destructive",
} as const;

export function getScoreColor(score: number): string {
  if (score >= 4.0) return SCORE_COLORS.high;
  if (score >= 3.0) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

/** CSS variable reference for score-based fills — dark mode対応済。
 *  利用側は `style={{ color: getScoreColorVar(score) }}` のように使う。 */
export function getScoreColorVar(score: number): string {
  if (score >= 4.0) return "var(--success, #22c55e)";
  if (score >= 3.0) return "var(--gold-warm)";
  return "var(--destructive)";
}

/** Background tint (10% opacity) for score cells — token 経由 */
export function getScoreBgClass(score: number): string {
  if (score >= 4.0) return "bg-[color-mix(in_oklab,var(--success,#22c55e)_12%,transparent)]";
  if (score >= 3.0) return "bg-[color-mix(in_oklab,var(--gold-warm)_12%,transparent)]";
  return "bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)]";
}
