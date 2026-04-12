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
  reviews: "口コミ",
  dress: "衣裳",
  photo_video: "写真・映像",
  flowers: "装花",
  staff_continuity: "スタッフ",
  capacity: "収容人数",
  cancellation: "キャンセル",
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
