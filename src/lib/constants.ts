export const TIER1_DIMENSIONS = [
  "atmosphere",
  "hospitality",
  "cuisine",
  "cost",
  "access",
  "reviews",
] as const;

export type Tier1Dimension = (typeof TIER1_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<string, string> = {
  atmosphere: "雰囲気",
  hospitality: "ホスピタリティ",
  cuisine: "料理",
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
  atmosphere: "チャペルや会場全体の雰囲気",
  hospitality: "プランナーやスタッフの対応",
  cuisine: "試食の味・量・プレゼンテーション",
  cost: "見積もりの納得感・コスパ",
  access: "駅からの距離・交通の便",
  reviews: "全体を通しての満足度",
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
