/**
 * Claude model IDs — Single Source of Truth.
 * 編集時は docs/ai/models.md の対応表も同時更新。
 */

export const MODEL = {
  /** 軽量・高頻度: コーチ会話、URL 取込、要約 */
  HAIKU: "claude-haiku-4-5-20251001",
  /** 標準: 推薦・分析・比較 */
  SONNET: "claude-sonnet-4-6",
  /** 高難度: アーキ判断・複雑な推論（現状未使用） */
  OPUS: "claude-opus-4-7",
} as const;

export type ModelId = (typeof MODEL)[keyof typeof MODEL];
