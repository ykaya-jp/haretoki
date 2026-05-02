# Phase 3 — Partner Level 2 設計

**作成**: 2026-05-02 (worker A、round 22)
**状態**: 設計 doc。実装は Phase 3 ウェーブ 1 で着手予定
**根拠**: PENDING.md L143「Partner Level 2 (6 次元星評価) — Phase 1 W18-2 が未着手のまま残置」

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

### Wave 1.1: rating-section の partner row 追加 (~3h)

- `rating-section.tsx` に partner row を追加 (member fetch + role join)
- `RatingBar` に `editable: boolean` prop を渡し、own-only 編集
- 既存 owner test に partner 視点 test を追加 (~5 件)

### Wave 1.2: VisitNote partner 編集 (~2h)

- `visit-note-form.tsx` に own-only 編集ガード
- partner row の note を read-only で表示
- (optional) `visibility` enum は Level 3 で

### Wave 1.3: couple-comparison surface 拡張 (~2h)

- `rating-comparison-card` を partner role でも render
- 「ふたりで比べる」ボタンを partner にも表示

### Wave 1.4: Partner upgrade hint (~1h)

- 初回 login hint (`onboarding_partner_can_rate_seen`)
- A-5 hint と同 pattern

### Wave 1.5: docs + analytics (~1h)

- `docs/lessons.md` に Level 2 完了知見
- analytics events: `partner_rating_submitted` / `partner_note_edited`

**合計**: 約 9h (1 worker、3 日分散) or 並列で 1 日

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
