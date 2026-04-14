/** Estimate item presets with category mapping. */

/** Categories accepted by the server-side estimateSchema enum. */
export type EstimateCategory =
  | "attire"
  | "cuisine"
  | "photo_video"
  | "flowers"
  | "performance"
  | "av_equipment"
  | "venue_fee"
  | "other";

export interface EstimatePreset {
  name: string;
  category: EstimateCategory;
  categoryLabel: string;
}

export const ESTIMATE_PRESETS: EstimatePreset[] = [
  // 飲食
  { name: "料理", category: "cuisine", categoryLabel: "飲食" },
  { name: "飲物", category: "cuisine", categoryLabel: "飲食" },
  { name: "ウェディングケーキ", category: "cuisine", categoryLabel: "飲食" },
  // 衣装
  { name: "新郎衣装", category: "attire", categoryLabel: "衣装" },
  { name: "新婦衣装（ドレス）", category: "attire", categoryLabel: "衣装" },
  { name: "和装", category: "attire", categoryLabel: "衣装" },
  { name: "小物", category: "attire", categoryLabel: "衣装" },
  // 装飾
  { name: "ブーケ", category: "flowers", categoryLabel: "装飾" },
  { name: "ブートニア", category: "flowers", categoryLabel: "装飾" },
  { name: "装花（メイン）", category: "flowers", categoryLabel: "装飾" },
  { name: "装花（ゲスト卓）", category: "flowers", categoryLabel: "装飾" },
  { name: "ヘッドドレス", category: "flowers", categoryLabel: "装飾" },
  // ビューティー → attire に寄せる
  { name: "ヘアメイク", category: "attire", categoryLabel: "ビューティー" },
  { name: "リハーサル", category: "attire", categoryLabel: "ビューティー" },
  { name: "エステ", category: "attire", categoryLabel: "ビューティー" },
  // 撮影
  { name: "写真", category: "photo_video", categoryLabel: "撮影" },
  { name: "映像", category: "photo_video", categoryLabel: "撮影" },
  { name: "スナップ", category: "photo_video", categoryLabel: "撮影" },
  { name: "前撮り", category: "photo_video", categoryLabel: "撮影" },
  { name: "当日撮影", category: "photo_video", categoryLabel: "撮影" },
  // 演出
  { name: "司会", category: "performance", categoryLabel: "演出" },
  { name: "生演奏", category: "performance", categoryLabel: "演出" },
  { name: "ドラ演出", category: "performance", categoryLabel: "演出" },
  { name: "キャンドルサービス", category: "performance", categoryLabel: "演出" },
  { name: "バルーンリリース", category: "performance", categoryLabel: "演出" },
  // ペーパー → other
  { name: "招待状", category: "other", categoryLabel: "ペーパー" },
  { name: "席次表", category: "other", categoryLabel: "ペーパー" },
  { name: "メニュー", category: "other", categoryLabel: "ペーパー" },
  { name: "プロフィールブック", category: "other", categoryLabel: "ペーパー" },
  { name: "席札", category: "other", categoryLabel: "ペーパー" },
  { name: "サンキューカード", category: "other", categoryLabel: "ペーパー" },
  // 引物 → other
  { name: "引出物", category: "other", categoryLabel: "引物" },
  { name: "引菓子", category: "other", categoryLabel: "引物" },
  { name: "プチギフト", category: "other", categoryLabel: "引物" },
  { name: "縁起物", category: "other", categoryLabel: "引物" },
  // 会場
  { name: "会場使用料", category: "venue_fee", categoryLabel: "会場" },
  { name: "サービス料", category: "venue_fee", categoryLabel: "会場" },
  { name: "控室料", category: "venue_fee", categoryLabel: "会場" },
  // その他
  { name: "宿泊費", category: "other", categoryLabel: "その他" },
  { name: "送迎バス", category: "other", categoryLabel: "その他" },
  { name: "親族衣装", category: "attire", categoryLabel: "その他" },
];
