/**
 * E-5 Final Two Duel — 情景ベース 2 択ミニクイズの問い一覧
 *
 * 5 問。具体的な映像が浮かぶ「情景」を問いにする。
 * 各選択肢は venueA / venueB それぞれのニュアンスに対応する。
 */

export type DuelLeans = "mood" | "memory" | "flow";

export interface DuelScene {
  id: string;
  /** 問いかけ。画面に大きく出る情景テキスト */
  moment: string;
  /** venueA を選んだときの選択肢テキスト */
  choiceA: string;
  /** venueB を選んだときの選択肢テキスト */
  choiceB: string;
  /** venueA 選択が表す感情軸 */
  leansToA: DuelLeans;
  /** venueB 選択が表す感情軸 */
  leansToB: DuelLeans;
}

export const DUEL_SCENES: DuelScene[] = [
  {
    id: "morning-balcony",
    moment: "式当日の朝。バルコニーへ出た瞬間の空気を想像してください。",
    choiceA: "光が差し込む開放感。「ここにして良かった」と静かに確信する。",
    choiceB: "凛とした空気に緊張が和らぐ。「今日が始まる」と胸が高鳴る。",
    leansToA: "mood",
    leansToB: "memory",
  },
  {
    id: "rain-start",
    moment: "披露宴が始まった頃、窓の外に雨が降り始めました。",
    choiceA: "雨音が会場に馴染んで、かえって内側の温かさが際立つ。",
    choiceB: "スタッフが素早く傘を用意してくれて、何も乱れない安心感がある。",
    leansToA: "mood",
    leansToB: "flow",
  },
  {
    id: "friend-tears",
    moment: "披露宴の終盤。旧来の友人が涙をこらえているのが見えました。",
    choiceA: "その涙が、空間の美しさと重なって、一枚の写真のように焼き付く。",
    choiceB: "ふたりの選択を、友人が丸ごと受け取ってくれている気がして、心が満ちる。",
    leansToA: "memory",
    leansToB: "mood",
  },
  {
    id: "photo-corner",
    moment: "ウェルカムスペースで、ゲストが写真を撮り合っています。",
    choiceA: "空間そのものが背景になって、どこを切り取っても絵になる。",
    choiceB: "自然に人が集まって、気づくと笑い声が絶えない場所になっている。",
    leansToA: "memory",
    leansToB: "flow",
  },
  {
    id: "last-song",
    moment: "最後の曲が流れ始め、ふたりがゆっくり歩き出す場面。",
    choiceA: "光と音楽が溶け合って、「夢みたい」という言葉が自然に出る。",
    choiceB: "ゲスト全員の顔が視野に入って、「来てくれて良かった」と思える。",
    leansToA: "mood",
    leansToB: "memory",
  },
];
