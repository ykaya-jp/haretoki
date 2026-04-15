# E-5 Final Two Duel — 最後の 2 つで迷うふたりへ

**モック**: [mockups/e-5-final-two-duel.html](../mockups/e-5-final-two-duel.html)
**優先度**: H
**関連**: W-5 (決定手前の沈黙), Decision model, 情緒的決断支援

---

## What

候補が **2 件 or 3 件に絞られ、決定できない状態** が 2 週間続いた時、ホームに「ふたりで 10 問、答えてみませんか」のカードが出る。タップすると **感情と想像力** を使った二者択一ゲームが始まる。

### 10 問の設計（情緒 × ストーリー）

各問は「どちらの式場で◯◯したいか」を情景描写で問う:

1. **朝の準備**: 「新婦が支度をしているとき、窓から差す光は？」
   - A: アマンの大手町の朝／ビル群から淡い光
   - B: リッツの六本木の朝／緑の公園からの光
2. **入場シーン**: 「扉が開いた瞬間、ゲストの視線が集まるのは？」
   - A: ガラスチャペルの光／空が見える
   - B: 石造りチャペルの荘厳さ／パイプオルガン
3. **料理の提供**: 「食事中、一番記憶に残るのは？」
   - A: シェフが席で仕上げる一皿
   - B: 伝統的な日本料理のおもてなし
4. **ゲストとの時間**: 「友人と話す時、どこにいたい？」
5. **二次会への流れ**: 「終わった後、みんなでどこへ？」
6. **写真**: 「10 年後に見返す、一番の 1 枚は？」
7. **親への挨拶**: 「親が一番喜ぶ瞬間は？」
8. **予算のリアリティ**: 「追加費用を正直に言うなら、どっちが安心？」
9. **未来の記念日**: 「5 周年の結婚記念日、どっちに戻りたい？」
10. **最後のひとこと**: 「今、どっちを選びたい気がする？」

最後の Q10 は**自分で選ばせる** (ネタバレ防止・決めるのは本人という姿勢)。

### 結果画面

10 問の集計 + **情緒的な言葉** で返す。
- 「リッツが 7／アマンが 3。**朝の光** と **ゲストとの時間** の質問で、リッツが響いていました。」
- コーチからの一言（Claude 生成）「どちらも素敵な選択です。ただ、ふたりは 'ゲストが笑顔でいる時間' を大切にしたい方なのかもしれません。」

「リッツに決める」「もう少し考える」「もう 1 回やり直す」の 3 択。

---

## Why

### 弱点解消
- **W-5 沈黙の 2 週間**: 決断直前、アプリに open する理由が消える。離脱最大タイミング
- **理性的比較の限界**: スコア差 0.2 とかで止まる。**決め手は感情**だが今はそれを言語化できない
- **共同意思決定の焦りのなさ**: 二人で話すきっかけ。「ねぇ、これやってみよう」が自然に起こる
- **決定直後の後悔予防**: 10 問の設問が「選ばれなかった理由」も言語化 → 決定後モヤモヤが軽減

### プロダクト効果
- **決定率の向上**: 離脱 2 週間 → 決定 1 週間に短縮
- **クチコミ起点**: 「これ面白かった」と友人に話す自然な動線
- **コーチとの連携**: duel 結果をコーチに引き継げる（「この結果について相談したい」→ ワンタップで /coach）

---

## How

### データモデル

```prisma
model FinalTwoDuel {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId  String   @map("project_id") @db.Uuid
  venueAId   String   @map("venue_a_id") @db.Uuid
  venueBId   String   @map("venue_b_id") @db.Uuid
  responses  Json     // [{q: 1, pick: "a"|"b"|null, weight: 1.0}, ...]
  summary    String?  // Claude 生成の情緒コメント
  startedAt  DateTime @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  venueA  Venue   @relation("DuelA", fields: [venueAId], references: [id])
  venueB  Venue   @relation("DuelB", fields: [venueBId], references: [id])

  @@index([projectId, completedAt])
  @@map("final_two_duels")
}
```

### 問題生成（Claude）

```ts
// src/lib/prompts/final-two-duel.ts
export const DUEL_PROMPT = {
  system: `あなたは結婚式場の 2 択を **情緒的に問う編集者** です。
2 つの式場の公開情報（写真・場所・雰囲気）から、
カップルの**感情と想像力**を刺激する 10 問を作ります。

## 出力 JSON
{
  "questions": [
    {
      "id": 1,
      "theme": "morning" | "entrance" | "cuisine" | "guests" | "afterparty" | "photo" | "parents" | "budget" | "anniversary" | "final",
      "question": "情景を含む 20-40 字の問い",
      "optionA": "A 会場の体験（30 字以内）",
      "optionB": "B 会場の体験（30 字以内）"
    },
    ...10 問
  ]
}

## スタイル
- 情景描写。「どちらが安いか」ではなく「どっちで支度したいか」
- 5W1H を問わない。「どちら？」でクローズ
- 感覚語（光・音・香り・温度・触感）を毎問 1 つ含める
- 10 問目だけはネタバレ防止で「今、どっちを選びたい気がしますか？」と素直に問う

## 禁止
- 数字の比較（費用・収容人数）
- 片方の批判
- 絵文字・！`,

  buildUserMessage: (venueA, venueB, conditions) => `...`,
};
```

### UI フロー

```
/decide/duel (entry)
  → starting screen: "○○と△△、ふたりで 10 問。5 分です"
  → 問 1 → 問 2 → ... → 問 10
  → 集計画面
  → 結果 (Claude 生成コメント)
  → 3 択 CTA: 決める / もう少し / やり直す
```

各設問は:
- 左右 2 カード（写真 + 情景テキスト）
- タップで即次へ（即時反応）
- 下部に "迷う" スキップ link（= null 記録）
- 親指 1 本で進められる（上下スワイプ禁止、左右タップのみ）

### 結果集計ロジック

```ts
function summarize(responses: Response[]) {
  const aCount = responses.filter(r => r.pick === "a").length;
  const bCount = responses.filter(r => r.pick === "b").length;
  const neutral = responses.length - aCount - bCount;

  // Weighted by theme (e.g., Q10 "final" weight 2.0)
  const weighted = responses.reduce((acc, r) => {
    const w = r.theme === "final" ? 2 : 1;
    if (r.pick === "a") acc.a += w;
    if (r.pick === "b") acc.b += w;
    return acc;
  }, { a: 0, b: 0 });

  const leaderId = weighted.a > weighted.b ? venueAId : weighted.b > weighted.a ? venueBId : null;
  const strongThemes = responses
    .filter(r => r.pick === leaderId ? "a" : "b")
    .reduce((acc, r) => ({ ...acc, [r.theme]: (acc[r.theme] || 0) + 1 }), {});

  return { aCount, bCount, neutral, leaderId, strongThemes };
}
```

結果に応じて Claude で情緒コメント生成:

```ts
// src/lib/prompts/duel-summary.ts
export const DUEL_SUMMARY_PROMPT = {
  system: `カップルが 10 問に答えた duel の結果を、
**どちらを選んでも肯定する** 温かいコメントにします。

## 入力
- leader venue name + count
- "strong themes" (どの領域で差がついたか)
- ユーザー条件 (optional)

## 出力 (プレーンテキスト, 100-150 字)
"${leader} が ${count}/10。特に ${themes.join(', ')} の場面で選ばれていました。どちらも素敵な選択です。もしこの結果に 'しっくりきた' なら、次の一歩に進んでみませんか。"

## トーン
- 決定を押しつけない
- 感情を肯定する
- 数字だけでなく "印象" に言及`,
};
```

### 発火条件

ホームの DailyRitual と連動:
- 本命 (VenueFavorite) 2-3 件
- 最終決定 (Decision) なし
- 最後の VenueFavorite 追加から **10 日以上経過**

この時 DailyRitual に代わりに:
```
"2件で迷って10日。ふたりで10問、答えてみませんか。"
[→ Final Two Duel を始める]
```

### 実装見積もり

| Phase | 内容 | 工数 |
|---|---|---|
| DB | FinalTwoDuel model + migration | 30 分 |
| Prompts | DUEL_PROMPT + DUEL_SUMMARY_PROMPT | 60 分 |
| Server Actions | startDuel / recordResponse / completeDuel + Claude calls + zod | 90 分 |
| UI Entry | 起点 CTA + ガイド画面 | 45 分 |
| UI Flow | 10 問 flow component (左右カード + スワイプ対応) | 3 時間 |
| UI Result | 集計画面 + コーチ連携 | 60 分 |
| Home trigger | DailyRitual から duel 提案 | 30 分 |
| **合計** | | **約 7 時間** |

---

## KPI

- 本命 2-3 件で 10 日停滞したプロジェクトの duel 着手率: 40%+
- duel 完了率 (Q1→Q10): 75%+
- duel 直後 3 日以内に Decision 発生率: 60%+
- duel 結果画面の NPS: 9/10（「面白かった」「話すきっかけになった」）

---

## 次の発展

- **Partner Duel**: 2 人が別々に 10 問答えて、答えの違いを見せる。夫婦ワークショップ化
- **Friend Duel**: 友人に 10 問送って意見を集める（LINE 共有）
- **Past Duels を振り返る**: 決定後に「あの時の duel 結果」を記念カードに入れる
