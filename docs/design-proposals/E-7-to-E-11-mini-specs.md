# E-7〜E-11: Mini 設計束

**モック**: [mockups/e-7-to-e-11.html](../mockups/e-7-to-e-11.html)

5 機能の中粒度 spec。Full spec 版は重要度が増した時に昇格する。

---

## E-7 Timeline — 晴れまでの道

**優先度**: M / **工数**: 約 5 時間

### What
`/journey` 新規タブ or マイページ内セクション。ふたりの歩みを **縦スクロール editorial** で見せる。

```
2026/04/10 ── 最初の式場を置きました「アマン東京」
2026/04/12 ── AI コーチに「2件で迷っている」と相談
2026/04/14 ── 見学 1 回目「ザ・リッツ」— ☀️晴れやか
2026/04/16 ── 本命に「アマン」を追加
2026/04/20 ── ファイナルチョイス「アマン東京」— 晴れの日へ
```

### Why
- **離脱復帰理由**: 1-2 週間アプリを開かないカップルが再開する時、「自分たちはどこまで来たか」を見返したい
- **情緒的ご褒美**: 決定セレモニーだけでなく、プロセス全体が作品化される
- **シェアの起点**: SNS で「Haretoki で式場選び記録してます」と言える絵柄

### How
```prisma
// 既存 model を元に timeline 生成（新 schema 不要）
// VenueFavorite.createdAt, Visit.completedAt, CoachSession.createdAt, Decision.createdAt etc
```
- Server Action: `getJourneyEvents` — 時系列にマージして返す
- UI: `JourneyTimeline` — 各イベントを明朝 + date + eyebrow + 薄い gold hairline で
- 最後の event の下に「次の一歩」CTA

---

## E-8 Question Bank — 見学当日の質問リスト

**優先度**: M / **工数**: 約 4 時間

### What
見学予定の前夜 21:00 に push / in-app で通知:
> 「明日の○○式場、これだけは聞いて 10 問」

式場タイプ（ホテル / 専門 / ゲストハウス）× カップルの条件から AI が厳選。カスタム追加も可能。

### Why
- **見学の質向上**: 何を聞けばいいか分からず、見学終了後「聞きそびれた」が頻発
- **妻の不安軽減**: 質問リストを事前に持っていると安心感
- **データ収集効果**: 見学後に「聞けたチェック」→ データが structured 化

### How
- 新 model: `VisitQuestionList { id, visitId, questions: Json (items with asked/notAsked/answer) }`
- Claude で 10 問生成（prompt 入力: venue features, conditions, stage）
- UI: `/visits/[id]/prep` 画面 + visit 完了後に checked/unchecked で記録

---

## E-9 Venue Whisper — 匿名口コミ AI 要約

**優先度**: M / **工数**: 約 3 時間（基盤は既存）

### What
既存の `Review.aiSummary` を VenueDetail に **静かに** 表示。2 行要約:
- 良い点: "料理と会場の雰囲気で評価が高い。スタッフの対応が丁寧"
- 気になる点: "見積もりが想定より +¥80 万上がった声が多い。駐車場が遠い"

### Why
- **既存実装の UI 露出不足**: `analyzeVenueReviews` は既にあるが、結果が venue detail で目立たない
- **中立性 ×2**: 式場側の PR ではない "第三者の声" が見えると信頼構築
- **購買前の不安解消**: クチコミを読み込む手間なしで要点が分かる

### How
- `Review.aiSummary` を `/venues/[id]` に 2 行要約カードで表示
- 「良い/気になる」の 2 軸 chip + Sparkles icon
- `n 件の匿名口コミから` のフッター
- 既存 `batchAnalyzeVenueReviews` を使って複数サイト × 自動要約

**新規コードほぼゼロ、UI 強化のみ。**

---

## E-10 Saved Search + 通知

**優先度**: M / **工数**: 約 5 時間

### What
`/explore` に「この条件を保存」ボタン。条件保存後、新しく合う式場が追加されたら「晴れ間バナー」で通知。

```
Saved: 東京 / 80-100名 / ¥300-400万 / 和装可
🌤 新しく合う式場が 2 件見つかりました
→ アマン東京, ザ・リッツ
```

### Why
- **回遊率**: 条件が厳しいカップルは「合う式場がない」で離脱しがち。見つかったら即通知
- **PWA 通知の正当化**: 「新着あります」はユーザーが許可しやすい
- **比較対象の拡張**: 最初の 3-5 件で止まらず、市場感を拡げる

### How
```prisma
model SavedSearch {
  id String @id @default(...)
  projectId String
  filters Json  // VenueFilters と同じ構造
  lastMatchCount Int @default(0)
  lastCheckedAt DateTime?
  createdAt DateTime @default(now())
}
```
- Cron で毎日 6:00 JST に全 savedSearch を評価 → 新規 match があれば DailyRitual か push で知らせる
- UI: explore 右上 `条件を保存` chip、マイページに保存済み一覧

---

## E-11 招待リンク（1-tap partner）

**優先度**: M / **工数**: 約 4 時間

### What
妻が partner-invite 画面で「リンクをコピー」or「LINE で送る」→ 夫がタップ → Google OAuth 瞬時ログイン → Project に自動 join。メールアドレス事前一致不要。

### Why
- **現状フリクション**: 同じメアドで Google OAuth 必要 → 半分以上の夫は脱落
- **Partner L2 の入口**: 二人で使う体験の最初の壁を壊す
- **Haretoki 独自**: 他競合よりフリクション極小

### How
- 招待 token を生成（既存 `ProjectMember.invitedAt` + 新 `invitationToken`）
- `/invite/[token]` ルート: トークン検証 → Google OAuth → token consume → ProjectMember.acceptedAt 更新
- 招待リンクに expiry（7 日）とワンタイム制
- セキュリティ: token は暗号学的乱数 32 バイト、CSRF 対策

---

## 共通: 実装順の推奨

1. **E-9 Venue Whisper** (3h) — 基盤ある、最短で効果
2. **E-11 招待リンク** (4h) — partner 流入増加の起点
3. **E-8 Question Bank** (4h) — visit 関連データ質向上
4. **E-10 Saved Search** (5h) — 通知基盤の最初の用途
5. **E-7 Timeline** (5h) — 情緒面、可視化
