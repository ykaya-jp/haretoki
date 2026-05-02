# Phase 3 — Partner Level 3 設計

**作成**: 2026-05-02 (worker A、round 24)
**状態**: 🟡 **設計骨格 (skeleton)**。本格実装は Level 2 の 1 ヶ月運用観測データを待つ
**根拠**: Level 2 設計 doc § 12「Level 3 への伏線」

> **読み方**: この doc は「観測データが揃ったら即着手できるよう、設計判断と schema 案を
> 先行して固めておく」位置づけ。実装フェーズに入る前に、§ 11「観測トリガー」の 3 数値が
> 出揃ってから wave 分割の優先順を決める (= ここで列挙した 3 軸のどれを最初に投資するか)。

---

## 0. 一行サマリー

**Level 2 で full member に昇格した partner と owner が、複数デバイス越しに、片方の編集を
即知る** — これが Level 3 が約束する体験。手段は 3 つ: (1) Realtime 同期、(2) Push 通知、
(3) multi-device 並行編集の conflict resolution。1 つでも体験を壊さず入れば前進。

---

## 1. 現状 (Level 2 完了時点)

### 何が動いているか

| 機能 | 実装 | 限界 |
|---|---|---|
| Owner / partner それぞれ自分の rating を編集 | ✅ rating-section.tsx (viewer-aware) | 相手の編集は revalidatePath まで反映されない |
| Couple comparison surface | ✅ partner-comparison-summary.tsx | 開いた瞬間の snapshot、片方が編集中でも気付けない |
| VisitNote の own / other 表示 | ✅ visits.ts | 同じ visit を 2 人が同時編集すると last-write-wins (告知なし) |
| Push 通知基盤 | ✅ B-1 PushSubscription model + B-2 dispatcher | 用途は visit reminder のみ。partner activity は未配信 |
| 多デバイス subscription | ✅ PushSubscription は `(userId, endpoint)` UNIQUE | 同 user の複数デバイス通知は B-2 dispatcher が並列 send 済 |

### 何がまだ「同じ部屋にいる感」を欠いているか

1. **編集の即時可視化なし**: owner が rating を入れても、partner は次に visit page を開く
   まで知らない (revalidateTag は server cache 無効化、client は再 navigate しないと再 fetch
   しない)。
2. **「相手が触った」シグナルなし**: 通知も、画面上のプレゼンス表示も、編集中の lock も
   ない。同 visit を同時編集すると意図せず後勝ち。
3. **デバイス間の「途中まで書いたメモ」が同期しない**: VisitNote draft (未保存) は
   localStorage 候補だが、片方の端末で書きかけたメモを別端末で続きから書くという体験は
   未提供。

---

## 2. Level 3 ゴール (3 軸)

### 軸 A: Realtime 同期 (Supabase Realtime)

「片方が rating / note を保存したら、もう片方の開いている画面に 1〜2 秒で反映される」。

- 対象データ: `VisitRating` / `VisitNote` / `Decision`
- 実現手段: Supabase Realtime の Postgres Changes チャンネル (CDC)
- channel scope: `project:{projectId}` 単位 (project member のみ subscribe 可、RLS で gate)

### 軸 B: Push 通知 (couple activity)

「partner が rating を入れた」「owner が決定を保存した」を相手にプッシュ。

- 対象 event: `partner_rating_added` (初回のみ) / `decision_saved` / `visit_note_first_save`
- 抑制: 同セッションで対面しているとき (両方が同 venue を 5 分以内に開いていた) は send 抑制
- 配信基盤: 既存 `PushSubscription` + Web Push API、B-2 dispatcher の payload を拡張

### 軸 C: Multi-device conflict resolution

「同 visit を 2 人が同時に編集した」を検出して、後から save した側に「相手も今編集中です」
を提示。完全な OT/CRDT は不要、soft locking + timestamp 競合検知で十分。

- presence: Supabase Realtime presence channel (誰が今このページを見ているか)
- soft lock: 「相手が編集中です」バナー (10 秒間 idle で解除)
- 競合通知: save 時に DB 上の `updatedAt` が ref と異なれば「相手の編集を取り込みますか?」
  ダイアログ

### 非ゴール (Level 4 以降)

- 完全な OT (operational transformation) — 過剰投資、couple は 2 人でしか編集しない
- voice / video presence — 別軸
- AI による会話 facilitation — coach 軸の延長で別 doc

---

## 3. Schema 変更案

### 3.1 軸 A (Realtime): schema 変更ゼロ

Supabase Realtime は既存 table の変更イベントを発火するため、新 model 追加なし。
追加で必要なのは:

- `supabase/migrations/` 側で `ALTER PUBLICATION supabase_realtime ADD TABLE visit_ratings, visit_notes, decisions;`
  (Prisma の管理外、Supabase ダッシュボード or sql migration)
- Row Level Security policy で「project member のみ subscribe」を gate
  (既存 RLS と同じ project_members join policy)

### 3.2 軸 B (Push): payload 拡張のみ

既存 `PushSubscription` をそのまま使う。新規 model 不要。
B-2 dispatcher の payload を `{ kind, projectId, venueId, actor }` に汎用化:

```typescript
type PushPayload =
  | { kind: "visit_reminder"; visitId: string; phase: "day_before" | ... }
  | { kind: "partner_rating_added"; venueId: string; actorUserId: string }
  | { kind: "decision_saved"; venueId: string; actorUserId: string }
  | { kind: "visit_note_first_save"; visitId: string; actorUserId: string };
```

抑制ロジック用に新 model 1 つ:

```prisma
/// Cooldown gate so two events in the same project within N minutes
/// don't double-notify. Keyed on (recipientUserId, kind, scopeId)
/// where scopeId = venueId | visitId | projectId depending on kind.
model PushSendLog {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  recipientUserId String   @map("recipient_user_id") @db.Uuid
  kind            String   // PushPayload['kind']
  scopeId         String   @map("scope_id") @db.Uuid
  sentAt          DateTime @default(now()) @map("sent_at")

  recipient User @relation(fields: [recipientUserId], references: [id], onDelete: Cascade)

  @@index([recipientUserId, kind, scopeId, sentAt])
  @@map("push_send_logs")
}
```

retention は既存 `data-retention-sweep` cron に乗せる。

### 3.3 軸 C (Conflict): VisitNote に `version` 追加

```prisma
model VisitNote {
  // ... existing fields
  version Int @default(0)  // optimistic concurrency token
}
```

- save 時に `WHERE version = :ref` で UPDATE → 0 行 update なら conflict
- conflict 時は client に「相手の編集を取り込む / 上書き / マージ画面」の 3 択を提示
- presence (誰が今編集中か) は schema レス、Realtime presence channel で揮発

`VisitRating` には version 不要 — `(visitId, userId, dimension)` UNIQUE が個人単位の編集を
分離しているので、owner と partner が同 dimension を同時に触ることはそもそも起きない。

---

## 4. 実装 wave 案 (観測データ次第で順番が変わる)

### Wave 3.1: Realtime 同期 — 最薄パス (~1 day)

- Supabase Realtime publication を visit_ratings / visit_notes に追加
- `useRealtimeProject(projectId)` hook を新規 (`src/hooks/`)、subscribe + ローカル
  cache invalidation
- venue 詳細ページ + comparison surface に hook を配線、変更が来たら router.refresh()
- E2E: 2 ブラウザで同 venue を開き、片方で rating 保存 → 数秒以内に他方が更新を見る

**観測トリガー**: Level 2 wave で `couple_comparison_viewed` が同 venueId に対して
24h 以内に複数発火する couple が 30% を超えたら最優先。

### Wave 3.2: Push 通知 (couple activity) (~1.5 day)

- `PushSendLog` model + migration
- B-2 dispatcher を partner activity event 対応に拡張 (payload 汎用化)
- `partner_rating_added` 初回 (per couple, per venue) のみ送信、後続の add は抑制
- 「対面中」抑制: 直近 5 分以内に同 venueId を見た記録があれば skip
- settings UI で「相手の活動通知」on/off を提供

**観測トリガー**: owner-add から partner-add までの中央値が 24h を超えたら最優先。

### Wave 3.3: Multi-device conflict resolution (~2 day)

- `VisitNote.version` 追加 + 楽観ロック実装
- Supabase Realtime presence channel で「編集中」のシグナル
- 「相手も編集中です」バナー (10 秒 idle で解除)
- 競合 ダイアログ (3 択 UI: 相手の編集を取り込む / 自分の編集で上書き / マージ画面)

**観測トリガー**: 5 分以内に同 visit を 2 人が編集したイベントが月 5 件以上で着手。

### Wave 3.4: docs + analytics (~0.5 day)

- 本 doc を「実装完了」に更新
- analytics: `realtime_update_received` / `push_partner_activity_sent|opened|dismissed` /
  `visit_note_conflict_detected|resolved`
- `/admin/onboarding-funnel` に L3 セクション追加

**合計**: 約 5 day (1 worker、観測トリガー次第で wave 順序を入れ替え)

---

## 5. Breaking change 評価

| 領域 | 影響 | mitigation |
|---|---|---|
| Schema | additive only (`PushSendLog` 新規、`VisitNote.version` Int @default(0) 追加) | rollout 中の旧 client は version=0 で書き続けるが、新 client が読むときに最新と一致しない conflict として扱われるだけ。データ破壊なし |
| Realtime publication | Postgres CDC の overhead | publication scope を 3 table に絞る。RLS で project member のみ subscribe |
| Push payload | 既存 visit_reminder の payload shape は維持、新 kind 追加のみ | client side dispatcher が unknown kind を no-op で無視する設計にする |
| 既存 owner / partner の体験 | 通知が増える / 画面が動く | settings で全 off にできる安全弁を必ず出荷時から提供 |

→ **breaking change ゼロ**、ただし「相手の編集が画面に勝手に反映される」体験変化は伝える
   必要あり (初回の hint surface 1 度だけ)。

---

## 6. 既知の限界 + リスク

### 6.1 Supabase Realtime の cost / scale

- Free tier の同時接続数は 200。商用化スケール (1000 couple 同時オンライン想定) で plan 変更
- 初期は publication 3 table のみで開始、コスト実測してから venue / project を追加検討

### 6.2 Push 通知の opt-in 率

- iOS Safari の Web Push は PWA インストール後のみ。インストール率次第で adoption 上限
- Android は通常の subscribe 経路で OK
- 「対面中」抑制が誤発火 (片方だけ見ていたケースを couple として扱う) のリスク → 5 分窓は
  仮置き、観測で調整

### 6.3 Conflict resolution の UX 複雑度

- 3 択ダイアログが couple に「ストレスを増やす」リスク。最初は「相手の編集を取り込む」を
  primary、他 2 つは secondary として階層化
- 完全に conflict を出さない選択肢は OT/CRDT だが、couple 用ツールには過剰

### 6.4 Wave 3.1 の N+1 リスク

- Realtime payload で受け取った change を SWR / cache に反映する際、全 component を
  router.refresh() で再 render するのは雑。最終形は store ベース (zustand 等) にする
- 初期は router.refresh() で OK、観測で performance 痛ければ移行

---

## 7. Open questions (実装前に決める)

1. **Realtime の reconnect 戦略**: 数秒オフライン → 戻ってきたとき、欠けた change をどう
   埋めるか。current draft: 接続復帰時に最新 snapshot を full fetch (差分計算しない)。
2. **Push 通知の channel grouping**: 同 venueId の複数 event を 1 通知にまとめるか個別に
   送るか。current draft: 個別 (couple のリアクション速度を優先)。
3. **「相手の編集を取り込む」のマージ画面が要るか**: VisitNote は free text なので「相手は
   X を加筆、自分は Y を加筆」の自動マージは難しい。current draft: マージ画面は出さず、
   「相手の最新を見せる + 自分の編集を別バッファに退避」で逃げる。
4. **Settings 粒度**: 通知 on/off を per kind (rating / decision / note) にするか on/off の
   2 段にするか。current draft: 2 段から開始、要望が出たら細分化。

---

## 8. 観測トリガー (Level 3 着手判断)

Level 2 運用 1 ヶ月後 (2026-06-02 目安) に `/admin/onboarding-funnel` の数字で判断:

| 指標 | 閾値 | 着手 wave |
|---|---|---|
| 同 venueId に対する couple_comparison_viewed が 24h 以内に複数発火する割合 | ≥ 30% | wave 3.1 (Realtime) を最優先 |
| owner_rating_added → partner_rating_added の時間差中央値 | ≥ 24h | wave 3.2 (Push) を最優先 |
| 同 visit を 5 分以内に 2 人が編集した発生数 | ≥ 5 件 / 月 | wave 3.3 (Conflict) を最優先 |
| すべて閾値未満 | — | Level 3 着手保留、別軸 (Decision 後フェーズ等) を優先 |

---

## 9. 関連ドキュメント

- `docs/phase3/partner-level-2-design.md` § 12 — 本 doc の伏線
- `prisma/schema.prisma` L827 `PushSubscription` — B-1 で導入済の基盤
- `src/server/actions/ratings.ts` `getCoupleRatings` — Level 2 viewer-aware API
- `docs/PENDING.md` — Phase 3 全体の context
- Supabase Realtime docs: https://supabase.com/docs/guides/realtime
- Web Push protocol: https://web.dev/articles/push-notifications-overview

---

## 10. 履歴

- 2026-05-02 (round 24): skeleton 初版作成 (worker A、Level 2 wave 1.5 と同時)
