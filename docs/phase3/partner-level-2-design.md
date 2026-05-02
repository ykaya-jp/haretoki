# Phase 3 — Partner Level 2 設計

**作成**: 2026-05-02 (worker A、round 22)
**状態**: ✅ **実装完了** (2026-05-02、wave 1.1〜1.5 すべて develop に merge 済)
**根拠**: PENDING.md L143「Partner Level 2 (6 次元星評価) — Phase 1 W18-2 が未着手のまま残置」

> **読み方**: 当初の設計（§ 1〜10）は決定時点のスナップショットとして残してあるので、
> 「なぜこの選択をしたのか」を遡るときはそのまま信頼してよい。実装中に変えた設計判断と
> 受けた教訓は § 11、Level 3 への引き継ぎは § 12 に追記してある。

---

## 0. 一行サマリー

**Partner role を guest 程度の閲覧者から「自分の 6 次元星評価 + コメントを入れる full member」に昇格させる**。
データ層 (auth / schema / role-aware ガード) は Phase 1 W18-3 で既に整備済 — 残るのは
UI surface と couple summary 表示の追加。breaking change なし、additive。

---

## 1. 現状 (Phase 2 完了時点)

### Partner role の現状能力

| 機能 | Owner | Partner (Level 1) | 出典 |
|---|---|---|---|
| プロジェクト閲覧 (venues / estimates / decisions) | ✅ | ✅ | `requireProjectMembership` |
| 候補追加 / 削除 (`VenueFavorite`) | ✅ | ✅ | favorites.ts (project-scoped) |
| 自分の評価 (`VisitRating`) を入力 | ✅ | ⚠️ schema は許可、UI から入れられない | rating-section.tsx は owner UI のみ |
| 自分のコメント (`VisitNote`) を編集 | ✅ | ⚠️ schema は許可、UI から入れられない | visits.ts (own-only ガード) |
| 招待リンク発行 / partner 招待 | ✅ | ❌ | invitation-links.ts (`requireOwner`) |
| プロジェクト名・条件編集 | ✅ | ❌ | onboarding.ts (`requireOwner`) |
| weight 設定 | ✅ | ✅ (W18-1 で実装済) | weights.ts (per-member) |
| AI 推薦 / coach / matrix | ✅ | ✅ | project-scoped 全 surface |
| 最終決定 (Decision) | ✅ | ❌ | decisions.ts (`requireOwner`) |

### Schema 既存の準備度

`schema.prisma` は **role-aware** に既に設計済 — Level 2 で新規 model 追加は不要:

- `ProjectMember.role` (`owner | partner` enum) で識別
- `VisitRating.userId` で member ごとの評価を分離
- `VisitNote.userId` で member ごとのコメントを分離
- `weights Json` (W18-1) で per-member の比較 weight を保持
- 全ての評価系 model が `(visitId, userId, dimension)` の UNIQUE 制約を持つ →
  partner が同 visit に評価を入れても owner の評価を上書きしない

### Auth 既存の準備度

`src/server/auth.ts` (W18-3 完了):

- `requireProjectMembership(userId)` — owner / partner 両方 OK
- `requireOwner(userId)` — owner のみ
- 個人データ (rating / note / favorite) は **own-only** で write 可能
- 共有データ (venue / estimate) は両方 read / write 可能
- destruction 系 (deleteVenue) は owner-only — W18-3a で dual-confirmation 検討中

→ **partner が UI から評価を入れる server action 経路は既にすべて 開いている**。
   止めているのは UI の surface だけ。

---

## 2. Level 2 ゴール

3 行で:

1. **partner が自分の 6 次元星評価を入れる UI** を rating-section に追加
2. **partner が自分のコメントを編集する UI** を VisitNote 系に追加
3. **couple summary view** で owner + partner の 2 人分を見える化 (rating-comparison.ts は既に存在 — UI 側だけ拡張)

### 非ゴール (Level 3 に持ち越し)

- Realtime 同期 (Supabase Realtime) — Level 3
- Partner Push 通知 — Level 3
- Partner が招待 / プロジェクト編集 / 最終決定できる — design 上は **意図的に owner-only 維持**
  (couple として「2 人で決めた」感を担保するため)

---

## 3. 必要 schema 変更案

**結論: schema 変更ゼロでも Level 2 は実装可能**。以下は optional (UX 向上のため):

### 3.1 必須: なし

既存 model のまま、auth と UI で partner surface を開けば完了。

### 3.2 推奨 optional: `VisitRating.role` cache (パフォーマンス)

couple summary で owner と partner の評価を side-by-side する際、
`VisitRating.userId` から `ProjectMember.role` を join で resolve する必要がある。

| 案 | pros | cons |
|---|---|---|
| (A) join で resolve | schema 変更ゼロ | 1 visit あたり join 1 段増 |
| (B) `VisitRating.memberRole: ProjectRole?` cache | 1 query で role 取得 | denormalized、role 変更時の同期コスト |

**判断**: (A) で進める。partner role 変更は実質起こらない (owner が partner を kick → 招待し直し)
ので join 1 段の cost より denormalize の保守負担が大きい。Phase 3 で実測して N+1 が
痛ければ (B) に切替。

### 3.3 推奨 optional: `VisitNote.visibility` enum

owner が「partner には見せたくないメモ」を残す surface があれば便利だが、
**Level 2 ではすべて couple-shared を default** にする (シンプル優先)。
`visibility: "couple" | "private"` enum 追加は Level 3 候補。

---

## 4. UI flow

### 4.1 Visit 詳細画面の rating-section

現状: owner の rating UI が `RatingBar` (0.5 刻み水平バー) で 6 次元 × 1 列。

変更:

```
┌─────────────────────────────────────┐
│ Rating                              │  ← gold eyebrow
│                                     │
│ 雰囲気    ・あなた  ●●●●○ 4.0     │
│           ・partner ●●●○○ 3.5     │  ← 名前は ProjectMember.user.name
│                                     │     、未取得は「相棒」placeholder
│ 接客      ・あなた  ●●●●● 5.0     │
│           ・partner ●●●●○ 4.0     │
│ ...                                 │
└─────────────────────────────────────┘
```

### 4.2 「自分の評価」モード切替

partner も同一 UI を使う — current user の `userId` から自動で「あなた」行を編集対象に切替。
要は **viewer-aware**: 同じ component が、見ている人によって編集可能な行が変わる。

実装: `useUser()` の id を `RatingBar` に渡し、`row.userId === currentUserId` のとき hover/tap で
編集可能、それ以外は read-only。

### 4.3 Couple comparison surface

`rating-comparison.ts` は既に owner + partner の評価差分を計算する server action。
今まで owner UI のみで使われていたが、partner にも同じ surface を expose:

- 「ふたりで比べる」ボタン (現状あり) は role 問わず表示
- `rating-comparison-card` も partner role で render

### 4.4 Comment 編集の visibility

`VisitNote` も同様 — current user 自身のメモは編集 / 削除可能、相手のメモは read-only。

### 4.5 Partner UX onboarding hint

partner が初回 login したときに「あなたも評価できます」を 1 度だけ surface (localStorage 永続化)。
A-5 partner-invite hint と同じ pattern (`onboarding_partner_can_rate_seen` 等)。

---

## 5. Breaking change 評価

| 領域 | 影響 | mitigation |
|---|---|---|
| Schema | なし (additive 変更も optional) | n/a |
| Auth | 既存 `requireProjectMembership` を拡張せず、そのまま使う | n/a |
| 既存 owner の体験 | UI に「あなた」「partner」ラベルが追加表示される | partner 未参加プロジェクトでは partner 行を render しない (空 row 回避) |
| 既存 partner の体験 | guest 程度から full member に **upgrade**、自分の row が編集可能に | 初回 login hint で UX 変化を伝える |
| API / Server actions | 既に role-aware → 変更なし | n/a |
| Tests | rating-section の test に partner 視点を追加 | unit test 数件追加で十分 |

→ **breaking change ゼロ**。Level 1 → Level 2 への移行は schema migration なしの単純な
   feature gate 解除。

---

## 6. 実装順 (Phase 3 ウェーブ 1)

### Wave 1.1: rating-section の partner row 追加 (~3h) — ✅ 完了

- ✅ `getCoupleRatings(venueId)` を新規追加 (viewer-aware: `{ ownRatings, otherRatings }`)
- ✅ `rating-section.tsx` を viewer-aware 化、partner も同 UI で自分の評価を編集
- ✅ `tests/unit/server/actions/get-couple-ratings.test.ts` で viewer-resolution を pin
- 設計と差分: `RatingBar editable: boolean` prop 案は不要だった (見える側＝編集側の単純 UI で
  済んだ)。partner row との 2 行レイアウトも、wave 1.3 の couple-comparison surface 側に
  まとめたほうが情報量がうまく散ったので rating-section 自体は 1 行（自分のみ）UI のまま。

### Wave 1.2: VisitNote partner 編集 (~2h) — ✅ 完了

- ✅ visits.ts の own-only ガードはそのまま使えた (Phase 1 W18-3 で既に整備済)
- ✅ partner も自分のメモを CRUD 可能、相手のメモは read-only

### Wave 1.3: couple-comparison surface 拡張 (~2h) — ✅ 完了 (worker C2)

- ✅ `partner-comparison-summary.tsx` を polish (column header 名、divergence hairline、
  agreement の色を success token から gold-subtle に統一)
- ✅ 「ふたりで比べる」ボタンを role 区別なく表示

### Wave 1.4: Partner upgrade hint (~1h) — ✅ 完了 (worker C2)

- ✅ `partner-can-rate-hint.tsx` 新規 (server gate: partner role + zero own ratings)
- ✅ A-5 OnboardingPartnerHint と同 rAF defer + localStorage tri-state pattern
- ✅ track events: `onboarding_partner_can_rate_seen|clicked|dismissed`

### Wave 1.5: docs + analytics (~1h) — ✅ 完了

- ✅ 本 doc を「実装完了」マーク + § 11 lessons + § 12 次フェーズ伏線
- ✅ analytics events 確定: `partner_rating_added` (前値 0) / `partner_rating_edited` (前値 > 0) /
  `couple_comparison_viewed` (mount per venueId)
  — 当初案の `partner_rating_submitted` 1 種ではなく added/edited 2 種に分けた (添加と編集は
  ファネル上の意味が違う: 「初回 add」が partner adoption の本丸、「edit」は健全な再訪
  シグナル)
- ✅ `/admin/onboarding-funnel` に Partner L2 セクションを追加 (6 行)
- ✅ deprecated `getPartnerRatings` proxy を削除 (compare-redesigned.tsx を viewer-aware に
  migrate 完了 → 残 caller ゼロ)

**合計実績**: 約 6h (3 worker 並列、1 日)。当初見積の 9h を下回ったのは Phase 1 の auth /
schema 整備 (W18-3) が想定以上に先回りしていたため。

---

## 7. Phase 3 全体の context

Level 2 が完了したら Level 3 へ:

- Realtime 同期 (Supabase Realtime + edge function) — couple 同時編集の conflict 解消
- Partner Push 通知 — owner が rating を入れたら partner に push、逆も
- Partner-specific notification preferences

Level 3 は schema 変更を伴う (Realtime channel state、conflict resolution metadata)。
Level 2 で UI surface を整え、観測データ (どれだけ partner が rate を入れるか) を 1 ヶ月
取ってから Level 3 を本格実装するのが推奨。

---

## 8. リスク + 既知の限界

- **role 変更頻度の実測がない**: 現状 partner が抜けて owner が招待し直すケースの実頻度は
  未計測 → 3.2 の (A) 案 (join resolve) で N+1 が問題化するかは production 後で測定
- **UI の名前 placeholder 「相棒」**: partner.user.name 未設定時のフォールバック、A-3 で
  「お名前 (任意)」を取らないと「相棒」のまま。改善は別タスク
- **「partner には見せない private note」**は意図的に Level 2 では作らない — Level 1 期待値
  との整合性 (couple は全データ共有) を維持

---

## 9. Open questions

1. **owner が partner の評価を編集できるべきか?** → 推奨: NO。"自分の評価は自分のもの" を
   貫く。owner は自分の評価のみ編集可。
2. **Level 2 で 「partner も決定 (Decision) ボタンを押せる」 を許可すべきか?** → 推奨: NO。
   couple として 2 人で決めたい体験のため、決定は owner のみ (Level 3 でも維持)。
3. **rating-comparison の表示順**: owner 上 → partner 下 か、role 区別なく fixed か。
   推奨: owner 上 → partner 下 (UI 一貫性)。

---

## 10. 関連ドキュメント

- `prisma/schema.prisma` — VisitRating / VisitNote / ProjectMember
- `src/server/auth.ts` — requireProjectMembership / requireOwner
- `src/server/actions/rating-comparison.ts` — couple 評価差分
- `docs/PENDING.md` L143 — Partner Level 2 の context
- `docs/phase3/` — Phase 3 設計 doc 群 (本ファイル含む)
- `docs/phase3/partner-level-3-design.md` — 次フェーズ (Realtime + Push + multi-device)

---

## 11. 実装中に学んだこと (round 23-24)

### 11.1 「role-keyed」と「viewer-aware」は別物 — 既存 API のリネームでは済まない

**事象**: 当初の `getPartnerRatings(venueId)` は `{ ownerRatings, partnerRatings }` を返す
role-keyed API。owner が見るときは「自分 vs partner」で正しく機能していたが、
partner が同 surface を見ると **partnerRatings に自分のスコアが入る** ため、
「あなた」行と「パートナー」行の両方に同じスコアが並ぶ double-count バグになった。

**修正**: `getCoupleRatings(venueId)` を新規追加し、`{ ownRatings (= viewer), otherRatings (= the other) }`
の **viewer-aware shape** に切替。テスト 6 件で viewer-resolution を pin。
`getPartnerRatings` は thin proxy として 1 round 残し、wave 1.5 で削除。

**教訓**: **role を payload key にしている API は、role が複数ある世界観に拡張した瞬間に必ず
歪む**。最初から viewer-aware で設計するか、role-keyed の段階で「ここは owner が見る前提」
の境界を README にも明記する。再発予防として `tests/unit/server/actions/get-couple-ratings.test.ts`
の "regression guard" テスト (partner viewer の own ≠ other) を残してある。

### 11.2 Phase 1 W18-3 の auth 投資が wave 1.1〜1.2 を半分の工数で終わらせた

**事象**: rating-section / visit-note の partner 編集を「open」する際、新しい permission
判定を 1 行も書かなくて済んだ。Phase 1 で `requireProjectMembership` (owner / partner 両 OK)
+ own-only データガード (rating / note の userId match) を引き終えていたため。

**教訓**: 「将来 partner を full member に昇格させる」前提で auth 層を一段早く整備したのは
正解だった。schema を additive で組んでおく (`VisitRating.userId` を nullable にしない、
`(visitId, userId, dimension)` UNIQUE) ことが、後から「surface だけ開ける」を可能にする。

### 11.3 React Compiler purity rule は rAF defer 一択

**事象**: wave 1.4 (`partner-can-rate-hint.tsx`) で localStorage 読み + setState を
useEffect 内で同 tick に並べたら React 19 の `set-state-in-effect` が点灯。

**修正**: A-5 OnboardingPartnerHint と同じ `requestAnimationFrame(() => { setX(...); track(...) })`
パターンで defer。wave 1.5 の `couple_comparison_viewed` (`partner-comparison-summary.tsx`)
も同じ recipe で実装。

**教訓**: rule を disable するな (lessons.md `[2026-04-30]` の通り)。プロジェクト内に
3 箇所同じパターンが揃った今、これが de-facto 標準。次に同種の hint / mount-time track が
増えたら同じ recipe を踏襲する。

### 11.4 analytics event は「added」と「edited」を分けるべき

**事象**: 当初は `partner_rating_submitted` 1 種で済ませる案だったが、ファネル上の意味が
違う (「初回 add」= adoption の本丸 / 「edit」= 健全な再訪) ので分割した。

**教訓**: track event を 1 種にまとめる前に「ダッシュボードで 2 つの数字を別々に見たいか?」
を自問する。Yes ならそもそも 2 event。後から `payload.kind: "added" | "edited"` で
分けるより、event 名で分けたほうが PostHog のファネルクエリが書きやすい。

### 11.5 「設計完了 → 並列実装」を 1 日で回せた要因

- **wave 分割が独立**: 1.1 (worker A) と 1.3+1.4 (worker C2) は別ファイルで衝突ゼロ。
  事前に「同一ファイルを 2 worker が触らない」境界を引いたことが効いた。
- **設計 doc が事前にあった**: round 22 で本 doc を書いてから round 23-24 で実装に
  入ったため、worker 間の認識合わせ (どの shape で何を返すか) が即決できた。
- **並列開発プロトコル**: feat/<id>-pane01 ブランチで push まで、merge は中央が引き受ける、
  develop に直接 commit しない (`~/.claude/projects/.../parallel_dev_protocol.md`) を全員
  徹底したことで orphan ブランチ事故ゼロ。

---

## 12. Level 3 への伏線 (next phase)

設計骨格は `docs/phase3/partner-level-3-design.md` に切り出してある。Level 2 を 1 ヶ月
運用してから観測データで再設計する **前提** のままだが、以下の 3 点は Level 2 の実装中に
既に「Level 3 で必要になる」と判明したので先送りせず明示しておく:

1. **`couple_comparison_viewed` の repeat 率を 1 ヶ月観測**: 同じ venueId を couple が
   複数回開く割合が高ければ、Realtime 同期の必要性 (片方が rate を更新したらもう片方の
   画面に即反映) が定量的に裏付く。低ければ「既存の revalidatePath 方式でも体感差は薄い」
   という判断ができる。
2. **`partner_rating_added` の owner-add から partner-add までの時間差**: 中央値が 24h を
   超えるなら Push 通知 (「○○さんが評価を入れました」) の adoption value が高い。短ければ
   couple は同セッションで触っているので Push の優先度は下げてよい。
3. **`VisitNote` の同時編集衝突発生数**: Level 2 では last-write-wins (実質、後から保存した
   方が勝つ)。観測で「同 visit を 5 分以内に 2 人が編集した」イベントが定常的にあるなら、
   Realtime presence + soft lock (片方が編集中はもう片方を read-only に) を Level 3 の
   wave 1 候補にする。

これらの数字は `/admin/onboarding-funnel` に counts wiring が入った時点で読めるようになる
(現状は scaffold)。Level 3 設計を本格実装に移すトリガーは「上記 3 点の観測値が出揃う」
ことに置いておく。
