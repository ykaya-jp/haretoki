/** Checklist preset library — 6 categories, ~90 items from wife-requirements.md §1–§6 */

export type ChecklistCategory =
  | "chapel"
  | "facility"
  | "banquet"
  | "dress_item"
  | "staff_estimate"
  | "cuisine_drink";

export type ChecklistItemType = "yesno" | "memo" | "photo" | "number";

export interface ChecklistPresetItem {
  id: string;
  category: ChecklistCategory;
  subcategory?: string;
  question: string;
  type: ChecklistItemType;
}

export const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  chapel: "挙式会場",
  facility: "設備",
  banquet: "披露宴会場",
  dress_item: "衣裳・アイテム",
  staff_estimate: "スタッフ・見積り",
  cuisine_drink: "料理・飲み物",
};

export const SUBCATEGORIES: Record<ChecklistCategory, string[]> = {
  chapel: ["インテリア・雰囲気", "ゲスト席", "演出"],
  facility: ["設備全般"],
  banquet: ["収容人数・レイアウト", "インテリア・雰囲気", "演出・照明・音響"],
  dress_item: ["衣裳・ヘアメイク", "アイテム"],
  staff_estimate: ["スタッフ", "見積り"],
  cuisine_drink: ["料理", "ドリンク・ケーキ"],
};

export const CHECKLIST_PRESETS: ChecklistPresetItem[] = [
  // ── CHAPEL: インテリア・雰囲気 ──────────────────────────────────────────
  {
    id: "chapel.interior.decor-style",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "内装や装飾は理想の雰囲気に合う？",
    type: "yesno",
  },
  {
    id: "chapel.interior.size",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "挙式会場の広さはちょうどいい？",
    type: "yesno",
  },
  {
    id: "chapel.interior.virgin-road",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "バージンロードの長さや素材は好み？",
    type: "yesno",
  },
  {
    id: "chapel.interior.lighting",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "窓の数、光の入り方、照明は？",
    type: "memo",
  },
  {
    id: "chapel.interior.cross-removable",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "（人前式の場合）十字架は外せる？",
    type: "yesno",
  },
  {
    id: "chapel.interior.shinto-style",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "（神前式の場合）スタイル・設備は満足？",
    type: "memo",
  },
  {
    id: "chapel.interior.non-family-attend",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "（神前式の場合）親族以外も参列できる？",
    type: "yesno",
  },
  // ── CHAPEL: ゲスト席 ───────────────────────────────────────────────────
  {
    id: "chapel.guest.capacity",
    category: "chapel",
    subcategory: "ゲスト席",
    question: "ゲストの最大収容人数は？",
    type: "number",
  },
  {
    id: "chapel.guest.spacing",
    category: "chapel",
    subcategory: "ゲスト席",
    question: "席と席の間隔や、ゲストとの距離感は？",
    type: "yesno",
  },
  {
    id: "chapel.guest.visibility",
    category: "chapel",
    subcategory: "ゲスト席",
    question: "どの席からも新郎新婦が見えやすい？",
    type: "yesno",
  },
  // ── CHAPEL: 演出 ───────────────────────────────────────────────────────
  {
    id: "chapel.performance.ceremony-style",
    category: "chapel",
    subcategory: "演出",
    question: "希望の儀式や親との演出はできる？（ベールダウン、リングリレーなど）",
    type: "yesno",
  },
  {
    id: "chapel.performance.music",
    category: "chapel",
    subcategory: "演出",
    question: "音楽の演奏方法は好みに合う？（生演奏か否か、曲目など）",
    type: "memo",
  },
  {
    id: "chapel.performance.effects",
    category: "chapel",
    subcategory: "演出",
    question: "希望の演出はできる？（フラワーシャワー、ブーケトス、バルーンリリースなど）",
    type: "yesno",
  },
  {
    id: "chapel.performance.rain-plan",
    category: "chapel",
    subcategory: "演出",
    question: "屋外で行う場合、雨天時の対応は？",
    type: "memo",
  },

  // ── FACILITY: 設備全般 ─────────────────────────────────────────────────
  {
    id: "facility.general.no-overlap",
    category: "facility",
    subcategory: "設備全般",
    question: "当日、他の結婚式と動線はかぶらない？",
    type: "yesno",
  },
  {
    id: "facility.general.flow",
    category: "facility",
    subcategory: "設備全般",
    question: "会場内はスムーズに移動できる？",
    type: "yesno",
  },
  {
    id: "facility.general.guest-room",
    category: "facility",
    subcategory: "設備全般",
    question: "ゲスト・親族控え室の数や広さ、椅子の数などは十分？",
    type: "yesno",
  },
  {
    id: "facility.general.brides-room",
    category: "facility",
    subcategory: "設備全般",
    question: "ブライズルームは好みの雰囲気？",
    type: "yesno",
  },
  {
    id: "facility.general.cloakroom",
    category: "facility",
    subcategory: "設備全般",
    question: "クロークやゲスト更衣室はある？",
    type: "yesno",
  },
  {
    id: "facility.general.nursing-room",
    category: "facility",
    subcategory: "設備全般",
    question: "授乳室、託児所はある？",
    type: "yesno",
  },
  {
    id: "facility.general.toilet",
    category: "facility",
    subcategory: "設備全般",
    question: "トイレの広さや個数、清潔感は？",
    type: "yesno",
  },
  {
    id: "facility.general.accessibility",
    category: "facility",
    subcategory: "設備全般",
    question: "エレベーターやバリアフリーの設備は？",
    type: "yesno",
  },
  {
    id: "facility.general.smoking",
    category: "facility",
    subcategory: "設備全般",
    question: "喫煙スペースまでのルートは？",
    type: "memo",
  },
  {
    id: "facility.general.accommodation",
    category: "facility",
    subcategory: "設備全般",
    question: "遠方ゲストの宿泊施設は会場内または近くにある？",
    type: "yesno",
  },

  // ── BANQUET: 収容人数・レイアウト ──────────────────────────────────────
  {
    id: "banquet.layout.capacity",
    category: "banquet",
    subcategory: "収容人数・レイアウト",
    question: "ゲストの最大収容人数は？",
    type: "number",
  },
  {
    id: "banquet.layout.table-capacity",
    category: "banquet",
    subcategory: "収容人数・レイアウト",
    question: "1卓当たりの最大人数と理想的な人数は？",
    type: "memo",
  },
  {
    id: "banquet.layout.main-visibility",
    category: "banquet",
    subcategory: "収容人数・レイアウト",
    question: "メイン卓から会場全体が見渡せる？",
    type: "yesno",
  },
  {
    id: "banquet.layout.guest-visibility",
    category: "banquet",
    subcategory: "収容人数・レイアウト",
    question: "ゲスト卓のどの席からでもメイン卓は見える？",
    type: "yesno",
  },
  // ── BANQUET: インテリア・雰囲気 ────────────────────────────────────────
  {
    id: "banquet.interior.flowers",
    category: "banquet",
    subcategory: "インテリア・雰囲気",
    question: "装花の種類は？ ボリュームや価格帯は？",
    type: "memo",
  },
  {
    id: "banquet.interior.linens",
    category: "banquet",
    subcategory: "インテリア・雰囲気",
    question: "テーブルクロスやナプキンは好みの色を選べる？",
    type: "yesno",
  },
  {
    id: "banquet.interior.lighting",
    category: "banquet",
    subcategory: "インテリア・雰囲気",
    question: "窓の数、景色や光の入り方、照明はどう？",
    type: "memo",
  },
  {
    id: "banquet.interior.garden",
    category: "banquet",
    subcategory: "インテリア・雰囲気",
    question: "ガーデンやテラスの様子は？",
    type: "memo",
  },
  // ── BANQUET: 演出・照明・音響 ──────────────────────────────────────────
  {
    id: "banquet.performance.space",
    category: "banquet",
    subcategory: "演出・照明・音響",
    question: "ふたりの希望の演出は叶う？（スペース、天井の高さ、防音など）",
    type: "yesno",
  },
  {
    id: "banquet.performance.screen",
    category: "banquet",
    subcategory: "演出・照明・音響",
    question: "スクリーンやプロジェクターの設備は整っている？",
    type: "yesno",
  },
  {
    id: "banquet.performance.sound",
    category: "banquet",
    subcategory: "演出・照明・音響",
    question: "音響の設備や音質は？ どの席からもよく聞こえる？",
    type: "yesno",
  },
  {
    id: "banquet.performance.lighting-variety",
    category: "banquet",
    subcategory: "演出・照明・音響",
    question: "照明のバリエーションはある？（スポットライト、キャンドルなど）",
    type: "yesno",
  },

  // ── DRESS_ITEM: 衣裳・ヘアメイク ──────────────────────────────────────
  {
    id: "dress_item.dress.variety",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "提携先の衣裳の種類やサイズは豊富？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.accessories",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "アクセサリーやヘッドアクセサリーの種類は豊富？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.bouquet",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "ブーケの種類・価格帯は？",
    type: "memo",
  },
  {
    id: "dress_item.dress.bring-in",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "持ち込みは可能？ 持ち込み料は？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.bring-in-fee",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "ドレス持ち込み料の金額は？",
    type: "number",
  },
  {
    id: "dress_item.dress.groom",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "新郎衣裳も充実している？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.family-rental",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "親族やゲストの衣裳もレンタルできる？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.family-hairmake",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "親族やゲストの着付け、ヘアメイクは可能？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.hairmake-style",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "好みのヘアメイクがかないそう？",
    type: "yesno",
  },
  {
    id: "dress_item.dress.plan-limit",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "衣裳プランの内容や選べる衣裳の限度額は？",
    type: "memo",
  },
  // ── DRESS_ITEM: アイテム ───────────────────────────────────────────────
  {
    id: "dress_item.items.paper",
    category: "dress_item",
    subcategory: "アイテム",
    question: "ペーパーアイテムの種類は？",
    type: "memo",
  },
  {
    id: "dress_item.items.gifts",
    category: "dress_item",
    subcategory: "アイテム",
    question: "ギフト（引出物や引菓子など）の種類は？",
    type: "memo",
  },
  {
    id: "dress_item.items.bring-in",
    category: "dress_item",
    subcategory: "アイテム",
    question: "アイテムの持ち込みはできる？ 持ち込み料は？",
    type: "yesno",
  },

  // ── STAFF_ESTIMATE: スタッフ ───────────────────────────────────────────
  {
    id: "staff_estimate.staff.planner",
    category: "staff_estimate",
    subcategory: "スタッフ",
    question: "見学時の担当者がプランナーになってくれる？",
    type: "yesno",
  },
  {
    id: "staff_estimate.staff.attitude",
    category: "staff_estimate",
    subcategory: "スタッフ",
    question: "担当者以外のスタッフの接客態度はどう？",
    type: "yesno",
  },
  {
    id: "staff_estimate.staff.external-mc",
    category: "staff_estimate",
    subcategory: "スタッフ",
    question: "司会やフォトグラファーは外部に頼める？",
    type: "yesno",
  },
  // ── STAFF_ESTIMATE: 見積り ─────────────────────────────────────────────
  {
    id: "staff_estimate.estimate.availability",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "日取りの空き状況は？",
    type: "memo",
  },
  {
    id: "staff_estimate.estimate.included",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "見積りに含まれる（含まれない）内容は？",
    type: "memo",
  },
  {
    id: "staff_estimate.estimate.payment-timing",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "支払いタイミングは？ 予約金などは？",
    type: "memo",
  },
  {
    id: "staff_estimate.estimate.payment-method",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "カード払い？ 現金払い？",
    type: "memo",
  },
  {
    id: "staff_estimate.estimate.campaigns",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "セットプランやキャンペーン、特典などはある？",
    type: "memo",
  },
  {
    id: "staff_estimate.estimate.cancellation",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "延期やキャンセル料の期間や条件、料金は？",
    type: "memo",
  },
  {
    id: "staff_estimate.estimate.total-amount",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "初回見積り総額は？",
    type: "number",
  },

  // ── CUISINE_DRINK: 料理 ────────────────────────────────────────────────
  {
    id: "cuisine_drink.cuisine.taste",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "料理の味、ボリューム、盛り付け方は満足？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.cuisine.ingredients",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "食材の希望はどこまで叶う？（産地など）",
    type: "memo",
  },
  {
    id: "cuisine_drink.cuisine.age-appropriate",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "ゲストの年齢層に合った料理が提供できる？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.cuisine.custom",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "アレンジは可能？（オリジナルメニューやアレルギー対応など）",
    type: "yesno",
  },
  {
    id: "cuisine_drink.cuisine.special-menu",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "特別メニューの取り入れは可能？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.cuisine.performance",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "できる料理演出は？（シェフのパフォーマンスなど）",
    type: "memo",
  },
  {
    id: "cuisine_drink.cuisine.tableware",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "プレートやカトラリーはテーマや好みに合う？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.cuisine.service-staff",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "サービススタッフの印象はいい？",
    type: "yesno",
  },
  // ── CUISINE_DRINK: ドリンク・ケーキ ───────────────────────────────────
  {
    id: "cuisine_drink.drink.variety",
    category: "cuisine_drink",
    subcategory: "ドリンク・ケーキ",
    question: "ドリンクの種類はゲスト層に合う？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.drink.cake",
    category: "cuisine_drink",
    subcategory: "ドリンク・ケーキ",
    question: "ウエディングケーキは好み？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.drink.cake-custom",
    category: "cuisine_drink",
    subcategory: "ドリンク・ケーキ",
    question: "ケーキのオリジナルデザインは可能？",
    type: "yesno",
  },
  {
    id: "cuisine_drink.drink.performance",
    category: "cuisine_drink",
    subcategory: "ドリンク・ケーキ",
    question: "できる料理演出は？（デザートビュッフェなど）",
    type: "memo",
  },

  // ── 写真撮影関連（共通メモ・写真） ────────────────────────────────────
  {
    id: "chapel.photo.interior",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "挙式会場の写真メモ",
    type: "photo",
  },
  {
    id: "banquet.photo.interior",
    category: "banquet",
    subcategory: "インテリア・雰囲気",
    question: "披露宴会場の写真メモ",
    type: "photo",
  },
  {
    id: "facility.photo.general",
    category: "facility",
    subcategory: "設備全般",
    question: "設備・施設の写真メモ",
    type: "photo",
  },
  {
    id: "dress_item.photo.dress",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "衣裳・ヘアメイクの写真メモ",
    type: "photo",
  },
  {
    id: "cuisine_drink.photo.food",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "料理・ケーキの写真メモ",
    type: "photo",
  },
  {
    id: "staff_estimate.photo.document",
    category: "staff_estimate",
    subcategory: "見積り",
    question: "見積書・資料の写真メモ",
    type: "photo",
  },

  // ── 総合メモ ────────────────────────────────────────────────────────────
  {
    id: "chapel.memo.overall",
    category: "chapel",
    subcategory: "インテリア・雰囲気",
    question: "挙式会場 総合メモ",
    type: "memo",
  },
  {
    id: "facility.memo.overall",
    category: "facility",
    subcategory: "設備全般",
    question: "設備 総合メモ",
    type: "memo",
  },
  {
    id: "banquet.memo.overall",
    category: "banquet",
    subcategory: "収容人数・レイアウト",
    question: "披露宴会場 総合メモ",
    type: "memo",
  },
  {
    id: "dress_item.memo.overall",
    category: "dress_item",
    subcategory: "衣裳・ヘアメイク",
    question: "衣裳・アイテム 総合メモ",
    type: "memo",
  },
  {
    id: "staff_estimate.memo.overall",
    category: "staff_estimate",
    subcategory: "スタッフ",
    question: "スタッフ・見積り 総合メモ",
    type: "memo",
  },
  {
    id: "cuisine_drink.memo.overall",
    category: "cuisine_drink",
    subcategory: "料理",
    question: "料理・飲み物 総合メモ",
    type: "memo",
  },
];

/** Lookup by item id */
export function getPresetById(id: string): ChecklistPresetItem | undefined {
  return CHECKLIST_PRESETS.find((item) => item.id === id);
}

/** Filter presets by category */
export function getPresetsByCategory(category: ChecklistCategory): ChecklistPresetItem[] {
  return CHECKLIST_PRESETS.filter((item) => item.category === category);
}

/** All category keys in display order */
export const CATEGORY_ORDER: ChecklistCategory[] = [
  "chapel",
  "facility",
  "banquet",
  "dress_item",
  "staff_estimate",
  "cuisine_drink",
];
