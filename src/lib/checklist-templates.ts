// Visit checklist templates based on real bride requirements
// 6 categories, 50+ items total

export interface ChecklistItem {
  item: string;
  sortOrder: number;
}

export interface ChecklistCategory {
  label: string;
  items: ChecklistItem[];
}

export const CHECKLIST_TEMPLATES: Record<string, ChecklistCategory> = {
  chapel: {
    label: "挙式会場",
    items: [
      { item: "内装や装飾は理想の雰囲気に合うか", sortOrder: 1 },
      { item: "挙式会場の広さはちょうどいいか", sortOrder: 2 },
      { item: "バージンロードの長さや素材は好みか", sortOrder: 3 },
      { item: "窓の数、光の入り方、照明", sortOrder: 4 },
      { item: "（人前式の場合）十字架は外せるか", sortOrder: 5 },
      { item: "ゲストの最大収容人数", sortOrder: 6 },
      { item: "席と席の間隔、ゲストとの距離感", sortOrder: 7 },
      { item: "どの席からも新郎新婦が見えやすいか", sortOrder: 8 },
      { item: "希望の儀式や親との演出ができるか（ベールダウン、リングリレーなど）", sortOrder: 9 },
      { item: "音楽の演奏方法は好みに合うか（生演奏、曲目）", sortOrder: 10 },
      { item: "希望の演出ができるか（フラワーシャワー、ブーケトス、バルーンリリースなど）", sortOrder: 11 },
      { item: "屋外の場合、雨天時の対応", sortOrder: 12 },
    ],
  },
  facility: {
    label: "設備",
    items: [
      { item: "当日、他の結婚式と動線がかぶらないか", sortOrder: 1 },
      { item: "会場内はスムーズに移動できるか", sortOrder: 2 },
      { item: "ゲスト・親族控え室の数や広さ", sortOrder: 3 },
      { item: "ブライズルームは好みの雰囲気か", sortOrder: 4 },
      { item: "クロークやゲスト更衣室はあるか", sortOrder: 5 },
      { item: "授乳室、託児所はあるか", sortOrder: 6 },
      { item: "トイレの広さや個数、清潔感", sortOrder: 7 },
      { item: "エレベーターやバリアフリーの設備", sortOrder: 8 },
      { item: "喫煙スペースまでのルート", sortOrder: 9 },
      { item: "遠方ゲストの宿泊施設は近くにあるか", sortOrder: 10 },
    ],
  },
  banquet: {
    label: "披露宴会場",
    items: [
      { item: "ゲストの最大収容人数", sortOrder: 1 },
      { item: "1卓当たりの最大人数と理想的な人数", sortOrder: 2 },
      { item: "メイン卓から会場全体が見渡せるか", sortOrder: 3 },
      { item: "ゲスト卓のどの席からでもメイン卓は見えるか", sortOrder: 4 },
      { item: "装花の種類、ボリュームや価格帯", sortOrder: 5 },
      { item: "テーブルクロスやナプキンは好みの色を選べるか", sortOrder: 6 },
      { item: "窓の数、景色や光の入り方、照明", sortOrder: 7 },
      { item: "ガーデンやテラスの様子", sortOrder: 8 },
      { item: "ふたりの希望の演出は叶うか", sortOrder: 9 },
      { item: "スクリーンやプロジェクターの設備", sortOrder: 10 },
      { item: "音響の設備や音質", sortOrder: 11 },
      { item: "照明のバリエーション", sortOrder: 12 },
    ],
  },
  dress_item: {
    label: "衣裳・アイテム",
    items: [
      { item: "提携先の衣裳の種類やサイズは豊富か", sortOrder: 1 },
      { item: "アクセサリーやヘッドアクセサリーの種類", sortOrder: 2 },
      { item: "ブーケの種類・価格帯", sortOrder: 3 },
      { item: "持ち込みは可能か、持ち込み料はいくらか", sortOrder: 4 },
      { item: "新郎衣裳も充実しているか", sortOrder: 5 },
      { item: "親族やゲストの衣裳レンタルは可能か", sortOrder: 6 },
      { item: "親族やゲストの着付け、ヘアメイクは可能か", sortOrder: 7 },
      { item: "好みのヘアメイクがかないそうか", sortOrder: 8 },
      { item: "衣裳プランの内容や選べる衣裳の限度額", sortOrder: 9 },
      { item: "ペーパーアイテムの種類", sortOrder: 10 },
      { item: "ギフト（引出物や引菓子）の種類", sortOrder: 11 },
      { item: "アイテムの持ち込みはできるか、持ち込み料", sortOrder: 12 },
    ],
  },
  staff_estimate: {
    label: "スタッフ・見積り",
    items: [
      { item: "見学時の担当者がプランナーになってくれるか", sortOrder: 1 },
      { item: "担当者以外のスタッフの接客態度", sortOrder: 2 },
      { item: "司会やフォトグラファーは外部に頼めるか", sortOrder: 3 },
      { item: "日取りの空き状況", sortOrder: 4 },
      { item: "見積りに含まれる/含まれない内容", sortOrder: 5 },
      { item: "支払いタイミング、予約金", sortOrder: 6 },
      { item: "カード払い/現金払い", sortOrder: 7 },
      { item: "セットプラン、キャンペーン、特典", sortOrder: 8 },
      { item: "延期やキャンセル料の期間・条件・料金", sortOrder: 9 },
    ],
  },
  cuisine_drink: {
    label: "料理・飲み物",
    items: [
      { item: "料理の味、ボリューム、盛り付け方", sortOrder: 1 },
      { item: "食材の希望はどこまで叶うか", sortOrder: 2 },
      { item: "ゲストの年齢層に合った料理が提供できるか", sortOrder: 3 },
      { item: "アレルギー対応、オリジナルメニューは可能か", sortOrder: 4 },
      { item: "料理演出はあるか", sortOrder: 5 },
      { item: "プレートやカトラリーはテーマに合うか", sortOrder: 6 },
      { item: "サービススタッフの印象", sortOrder: 7 },
      { item: "ドリンクの種類はゲスト層に合うか", sortOrder: 8 },
      { item: "ウエディングケーキの選択肢", sortOrder: 9 },
    ],
  },
};

export function getAllChecklistItems(): Array<{ item: string; category: string; sortOrder: number }> {
  return Object.entries(CHECKLIST_TEMPLATES).flatMap(([category, data]) =>
    data.items.map((item) => ({
      item: item.item,
      category,
      sortOrder: item.sortOrder,
    }))
  );
}
