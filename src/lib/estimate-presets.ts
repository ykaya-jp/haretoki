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

export type EstimateItemTier = "minimum" | "standard" | "premium" | "unknown";

export interface EstimatePreset {
  name: string;
  category: EstimateCategory;
  categoryLabel: string;
  defaultTier: EstimateItemTier;
}

export const ESTIMATE_PRESETS: EstimatePreset[] = [
  // 飲食
  { name: "料理", category: "cuisine", categoryLabel: "飲食", defaultTier: "standard" },
  { name: "飲物", category: "cuisine", categoryLabel: "飲食", defaultTier: "standard" },
  { name: "ウェディングケーキ", category: "cuisine", categoryLabel: "飲食", defaultTier: "standard" },
  { name: "ウェルカムドリンク", category: "cuisine", categoryLabel: "飲食", defaultTier: "standard" },
  { name: "デザートビュッフェ", category: "cuisine", categoryLabel: "飲食", defaultTier: "premium" },
  // 衣装
  { name: "新郎衣装", category: "attire", categoryLabel: "衣装", defaultTier: "standard" },
  { name: "新婦衣装（ドレス）", category: "attire", categoryLabel: "衣装", defaultTier: "standard" },
  { name: "和装", category: "attire", categoryLabel: "衣装", defaultTier: "premium" },
  { name: "小物", category: "attire", categoryLabel: "衣装", defaultTier: "standard" },
  { name: "親族衣装", category: "attire", categoryLabel: "衣装", defaultTier: "standard" },
  // ビューティー → attire に寄せる
  { name: "ヘアメイク", category: "attire", categoryLabel: "ビューティー", defaultTier: "standard" },
  { name: "リハーサル", category: "attire", categoryLabel: "ビューティー", defaultTier: "standard" },
  { name: "エステ", category: "attire", categoryLabel: "ビューティー", defaultTier: "premium" },
  { name: "着付け", category: "attire", categoryLabel: "ビューティー", defaultTier: "standard" },
  // 装飾
  { name: "ブーケ", category: "flowers", categoryLabel: "装飾", defaultTier: "standard" },
  { name: "ブートニア", category: "flowers", categoryLabel: "装飾", defaultTier: "standard" },
  { name: "装花（メイン）", category: "flowers", categoryLabel: "装飾", defaultTier: "standard" },
  { name: "装花（ゲスト卓）", category: "flowers", categoryLabel: "装飾", defaultTier: "standard" },
  { name: "ヘッドドレス", category: "flowers", categoryLabel: "装飾", defaultTier: "standard" },
  { name: "リングピロー", category: "flowers", categoryLabel: "装飾", defaultTier: "standard" },
  // 撮影
  { name: "写真", category: "photo_video", categoryLabel: "撮影", defaultTier: "standard" },
  { name: "映像", category: "photo_video", categoryLabel: "撮影", defaultTier: "standard" },
  { name: "スナップ", category: "photo_video", categoryLabel: "撮影", defaultTier: "standard" },
  { name: "前撮り", category: "photo_video", categoryLabel: "撮影", defaultTier: "premium" },
  { name: "当日撮影", category: "photo_video", categoryLabel: "撮影", defaultTier: "standard" },
  { name: "DVD編集", category: "photo_video", categoryLabel: "撮影", defaultTier: "standard" },
  { name: "アルバム", category: "photo_video", categoryLabel: "撮影", defaultTier: "standard" },
  // 演出
  { name: "司会", category: "performance", categoryLabel: "演出", defaultTier: "standard" },
  { name: "生演奏", category: "performance", categoryLabel: "演出", defaultTier: "premium" },
  { name: "ドラ演出", category: "performance", categoryLabel: "演出", defaultTier: "standard" },
  { name: "キャンドルサービス", category: "performance", categoryLabel: "演出", defaultTier: "standard" },
  { name: "バルーンリリース", category: "performance", categoryLabel: "演出", defaultTier: "standard" },
  { name: "ライスシャワー", category: "performance", categoryLabel: "演出", defaultTier: "minimum" },
  { name: "ファーストバイト", category: "performance", categoryLabel: "演出", defaultTier: "standard" },
  // 音響・照明
  { name: "音響設備", category: "av_equipment", categoryLabel: "音響・照明", defaultTier: "standard" },
  { name: "照明演出", category: "av_equipment", categoryLabel: "音響・照明", defaultTier: "standard" },
  { name: "プロジェクター・スクリーン", category: "av_equipment", categoryLabel: "音響・照明", defaultTier: "standard" },
  { name: "BGM選曲サービス", category: "av_equipment", categoryLabel: "音響・照明", defaultTier: "standard" },
  { name: "マイク設備", category: "av_equipment", categoryLabel: "音響・照明", defaultTier: "standard" },
  // ペーパー → other
  { name: "招待状", category: "other", categoryLabel: "ペーパー", defaultTier: "standard" },
  { name: "席次表", category: "other", categoryLabel: "ペーパー", defaultTier: "standard" },
  { name: "メニュー", category: "other", categoryLabel: "ペーパー", defaultTier: "standard" },
  { name: "プロフィールブック", category: "other", categoryLabel: "ペーパー", defaultTier: "standard" },
  { name: "席札", category: "other", categoryLabel: "ペーパー", defaultTier: "standard" },
  { name: "サンキューカード", category: "other", categoryLabel: "ペーパー", defaultTier: "standard" },
  // 引物 → other
  { name: "引出物", category: "other", categoryLabel: "引物", defaultTier: "standard" },
  { name: "引菓子", category: "other", categoryLabel: "引物", defaultTier: "standard" },
  { name: "プチギフト", category: "other", categoryLabel: "引物", defaultTier: "standard" },
  { name: "縁起物", category: "other", categoryLabel: "引物", defaultTier: "standard" },
  // 会場
  { name: "会場使用料", category: "venue_fee", categoryLabel: "会場", defaultTier: "standard" },
  { name: "サービス料", category: "venue_fee", categoryLabel: "会場", defaultTier: "standard" },
  { name: "控室料", category: "venue_fee", categoryLabel: "会場", defaultTier: "standard" },
  { name: "挙式料", category: "venue_fee", categoryLabel: "会場", defaultTier: "standard" },
  // その他
  { name: "宿泊費", category: "other", categoryLabel: "その他", defaultTier: "standard" },
  { name: "送迎バス", category: "other", categoryLabel: "その他", defaultTier: "standard" },
];
