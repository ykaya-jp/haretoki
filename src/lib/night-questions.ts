/**
 * R-5 "今夜の一問" — Daily Coach Question
 *
 * 毎晩、コーチ空状態の最上部に 1 問だけ並ぶ「話すきっかけ」。
 *
 * 実装方針 (v1): Claude を呼ばず、stage × day-of-year の deterministic な
 * rotation で 1 問を選ぶ。ゼロコスト・ゼロレイテンシ。
 * v2 で DailyRitual と合流して Claude 生成に切り替え可能。
 */

export type NightQuestionStage =
  | "start"
  | "adding"
  | "visiting"
  | "comparing"
  | "decided";

export interface NightQuestion {
  text: string;
  /** Suggested follow-up — ここから会話が広がりやすい種 */
  seed?: string;
}

const QUESTIONS_BY_STAGE: Record<NightQuestionStage, NightQuestion[]> = {
  start: [
    {
      text: "今夜、もし 1 つだけ伝えたいなら — ふたりの式は、どんな雰囲気にしたい？",
      seed: "雰囲気の方向性について話したい",
    },
    {
      text: "式場に求める『絶対外せないもの』を、3 つだけ挙げるとしたら？",
      seed: "3 つの優先条件を決めたい",
    },
    {
      text: "結婚式、何を一番楽しみにしていますか？",
      seed: "楽しみにしていることを共有したい",
    },
    {
      text: "逆に「これは避けたい」ポイントはありますか？",
      seed: "避けたいポイントを整理したい",
    },
  ],
  adding: [
    {
      text: "今日見た式場で、一番『好きだな』と思ったポイントはどこでしたか？",
      seed: "見た式場で印象的だったポイント",
    },
    {
      text: "ゲストの顔を思い浮かべたとき、どんな空間で迎えたいですか？",
      seed: "ゲスト視点でのイメージ",
    },
    {
      text: "もし 1 件だけ選ぶとしたら、今の時点でどこですか？理由は？",
      seed: "現時点の第一候補について話したい",
    },
    {
      text: "「この条件は譲れない」と気づいた瞬間はありましたか？",
      seed: "譲れない条件の自覚",
    },
  ],
  visiting: [
    {
      text: "見学した式場の料理、覚えている味はありますか？",
      seed: "料理の印象を振り返る",
    },
    {
      text: "見学中、プランナーさんの対応で印象的だったことは？",
      seed: "プランナーの対応について",
    },
    {
      text: "写真やメモを見返して、今の気持ちはどうですか？",
      seed: "振り返りと気持ちの整理",
    },
    {
      text: "見学中に『想像と違った』と感じた点はありますか？",
      seed: "予想と違ったポイント",
    },
  ],
  comparing: [
    {
      text: "数字では決められない「直感」、今どっちに傾いていますか？",
      seed: "直感的な傾き",
    },
    {
      text: "10 年後、どちらの会場の写真を見返したいですか？",
      seed: "10 年後の視点から考える",
    },
    {
      text: "もしどちらも選べるなら、友達をどちらに呼びたいですか？",
      seed: "友達目線での判断",
    },
    {
      text: "費用以外で、ふたりの意見が分かれているポイントは？",
      seed: "意見が分かれる点を整理",
    },
  ],
  decided: [
    {
      text: "決めた理由のうち、言葉にしておきたいものは何ですか？",
      seed: "決めた理由を言語化したい",
    },
    {
      text: "当日、ゲストに一番見てほしい場所はどこですか？",
      seed: "当日のハイライト",
    },
    {
      text: "準備で、今一番気がかりなことは？",
      seed: "準備の不安",
    },
    {
      text: "晴れの日、お互いのご家族にどう紹介したいですか？",
      seed: "家族への紹介のしかた",
    },
  ],
};

/**
 * JST today の day-of-year を使って、stage の質問から 1 つ選ぶ。
 * 同じ日に何度開いても同じ質問。日をまたぐと次の質問に進む。
 */
export function selectNightQuestion(stage: NightQuestionStage): NightQuestion {
  const list = QUESTIONS_BY_STAGE[stage];
  // day-of-year in JST
  const now = new Date();
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const jst = new Date(jstMs);
  const start = Date.UTC(jst.getUTCFullYear(), 0, 0);
  const diff = jstMs - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return list[dayOfYear % list.length];
}

/**
 * Derive stage from minimal project counts. Mirrors the ladder used by
 * DailyRitual / EditorialHero — keeps the two features coherent.
 */
export function stageFromCounts(counts: {
  venueCount: number;
  visitedCount: number;
  favoriteCount: number;
  hasDecision: boolean;
}): NightQuestionStage {
  if (counts.hasDecision) return "decided";
  if (counts.favoriteCount >= 2) return "comparing";
  if (counts.visitedCount >= 1) return "visiting";
  if (counts.venueCount >= 1) return "adding";
  return "start";
}
