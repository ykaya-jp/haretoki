# Phase 3 — Partner Level 3 設計

**作成**: 2026-05-02 (worker A、round 24)
**状態**: 🟢 **wave 1 + wave 4 実装完了** (broadcast scaffold + RLS policy + admin metric)
— wave 2 (Push) は B 担当進行中、wave 3 (offline reconcile) は C2 担当
**根拠**: Level 2 設計 doc § 12「Level 3 への伏線」

> **読み方**: 当初の設計（§ 1〜10）は決定時点のスナップショットとして残してある。wave 1
> 実装で固まった事実と方針転換は § 11 を見れば追える (skeleton → 実装の差分が分かる)。
> wave 2 / wave 3 着手判断は § 8 観測トリガーが満たされた時点で。

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

#### Wave 3.3 status — schema 部分は意図的に保留 (round 33)

`VisitNote.version` Int 追加は schema migration を必要とする。Phase 3 全体で
`prisma/schema.prisma` を触る並行作業 (worker A の Realtime publication、
worker B の round 21 admin/audit) があるため、 conflict-resolution 一本のために
schema を取りに行くと merge 衝突 risk が上がる。round 33 では以下を **schema
を触らずに先行投入** した:

- `src/lib/sync/offline-reconcile.ts` — generic offline mutation queue。
  visit-note-queue.ts (W20-1 の単一目的版) を namespace 引数付きで一般化。
  rating / note / 将来の checklist-answer すべてが同 primitive を共有できる。
- `shouldAcceptServerUpdate` / `dropStaleQueuedEntries` LWW 比較ヘルパー —
  Realtime event を受けたとき、 queue 上の payload と timestamp 比較して
  「 server が新しい → 受け入れ + queued は drop」 / 「queued が新しい →
  flush で server を上書き」 を判定する primitives。
- `<QueuedSavingIndicator>` UI primitive — 「オフラインで一時保存しました」
  「保存待機中 (N 件)」 を任意の form 横に subtle に表示する。
  `useOnlineStatus` + `queueLength()` を組み合わせるだけ。

**残作業 (実 schema migration を伴う)**:

1. `VisitNote.version Int @default(0)` 追加 + WHERE-version UPDATE
   migration。これは独立した round で `prisma migrate dev` を取って単独 PR。
2. `useRealtimeProject` (worker A 担当 wave 3.1) と本 round の reconcile lib
   を結合する hook。subscribe → onUpdate で `shouldAcceptServerUpdate` を
   gate にして cache を update / 棄却。
3. 競合 dialog の 3 択 UI — server が conflict (0 行 update) を返したとき。
   worker A の Realtime channel を subscribe している前提なので順序は
   wave 3.1 → 3.3 dialog の順。

これらが揃うと wave 3 全体が完了する。Round 33 の commit は (1)〜(3) 全部の
**foundation** を提供するが、couples が手で触る効果はまだ無い (queue を
読み書きする form 側 wire-up は wave 3.1 の RealtimeProvider が固まって
からのほうが clean)。

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
- 2026-05-02 (round 25): wave 1 (Realtime broadcast scaffold) 実装完了 (worker A)
- 2026-05-02 (round 26): wave 4 (RLS policy + admin metric) 実装完了 + Phase 3 完了宣言
  (`docs/phase3/COMPLETION.md`) (worker A)

---

## 11. wave 1 (Realtime) 実装ログ + 設計差分

### 11.1 当初設計との乖離: CDC ではなく Broadcast に倒した

**当初案 (§ 3.1, § 4 wave 3.1)**: Supabase Realtime の Postgres Changes (CDC) を visit_ratings
/ visit_notes に追加して、行変更を起点に router.refresh する。

**実装での発見**: CDC ベースの `useRealtimeSync` は **既に存在していた** (`src/lib/supabase/realtime.ts`)。
しかも完成度が高い (visit_ids でフィルタ、BroadcastChannel でタブ間共有、auth 再接続)。
新規追加すべきは「actor + intent を伝える別レイヤー」だった。

**判断**: CDC レイヤーは触らず、**Supabase Broadcast** を補完レイヤーとして新規追加。
2 層構成は意図的:
- CDC = 「何かが変わった」(行レベル、actor 不明) → router.refresh が main job
- Broadcast = 「{誰} が {何} した」(semantic event、actor 付き) → toast + router.refresh

**得られた効果**:
- 「データ整合性」と「社会的シグナル (toast)」が分離。CDC が正しく refresh する責務を
  維持しつつ、Broadcast は「誰がやったか」だけに集中できる。
- 新規 event の追加は server action 側に publishRealtimeEvent を 1 行加えるだけ。
  CDC の publication 設定 (Supabase ダッシュボード or SQL) を触らなくていい。
- Broadcast は server-only (admin client 経由) で publish するので、誰が何を broadcast
  できるかを完全にサーバー側でコントロールできる (自由 broadcast の悪用リスクなし)。

### 11.2 実装ファイル一覧

| ファイル | 役割 | LoC |
|---|---|---|
| `src/lib/realtime/events.ts` | RealtimeEvent 型 (discriminated union) + チャンネル名 + イベント名定数 | 〜90 |
| `src/lib/realtime/publish.ts` | server-side broadcast helper (`publishRealtimeEvent`, `resolveActor`) | 〜100 |
| `src/lib/realtime/use-realtime-project.tsx` | client hook (subscribe + dedup + self-filter + toast + router.refresh) | 〜130 |
| `src/components/realtime-provider.tsx` | 既存、CDC + Broadcast を併走させるラッパー | +20 |
| `src/app/(app)/layout.tsx` | viewerUserId を RealtimeProvider に渡す配線 | +1 |

### 11.3 publish 配線済 server actions

- `src/server/actions/ratings.ts saveRatings` — `rating_saved` (saveDirectRatings は内部で
  saveRatings を呼ぶので二重発火しない)
- `src/server/actions/visits.ts addVisitNote` — `note_added`
- `src/server/actions/decisions.ts makeDecision` — `decision_made`
- `src/server/actions/decisions.ts updateWeddingDate` — `wedding_date_updated`

### 11.4 確定した運用パラメータ

- **Channel naming**: `project:${projectId}` (UUID)
- **Event 名**: 単一の `haretoki:event` を使い、`payload.kind` で discriminate (Supabase
  の event index 効率を優先)
- **Self-filter**: 公開側で `broadcast.self = false`、subscriber 側でも
  `actor.userId === viewerUserId` を再 guard (二重防御)
- **Dedup window**: 5 秒、`(kind, scopeId, actorUserId)` をキーに client-side で collapse
- **Refresh policy**: 全 4 kind とも `router.refresh()` をトリガー (`setTimeout(_, 0)` で
  toast 描画と order を整える)
- **Toast コピー**: `${actor.name}さんが評価を残しました` 等 (Sonner の info / success レベル)

### 11.5 wave 1 の既知の限界 + 後続 wave への持ち越し

| 限界 | 影響 | 解消フェーズ |
|---|---|---|
| Broadcast の RLS policy 未敷設 | UUID を知っている任意のクライアントが subscribe 可能 (security through obscurity) | wave 1.5 / wave 2 同梱で `realtime.messages` の RLS policy SQL 追加 |
| 観測 metric 未取得 | wave 2/3 着手判断 (§ 8 トリガー) の数値が貯まらない | `couple_comparison_viewed` 等の既存 event を `/admin/onboarding-funnel` に counts wiring (Phase 3 別 wave) |
| 実機検証 (2 ブラウザで toast 表示) | dev/preview 環境でのみ確認、prod での verification は deploy 後 | Ship Cycle で verify |
| Wave 1.4 で C2 が入れた `partner-can-rate-hint` との衝突なし | 確認済 (different surface) | — |
| Service worker / push との関係 | wave 2 で接続。wave 1 単独では offline / background 通知なし | wave 2 |

### 11.6 lessons (wave 1 で学んだこと)

#### Lesson A: 既存実装を grep してから設計に倒さない

`useRealtimeSync` の存在を当初設計時に grep し損ねていた。実装フェーズで気付いて路線変更
できたが、危うく「既存と機能重複した CDC レイヤーをもう 1 つ作る」事故になりかけた。
**教訓**: 設計 doc の「現状」を書く時点で `grep -r realtime src/` レベルの確認をする。

#### Lesson B: best-effort publish は本気で best-effort にする

`publishRealtimeEvent` を `await` するか fire-and-forget で投げるかで悩んだが、`await`
+ helper 内部で全 catch という形に倒した。理由:
- fire-and-forget だと server action の test で broadcast 完了を待てない
- `await` でも helper が throw しないので user 体験には影響しない
- request lifecycle 内で確実に socket close できる (リーク防止)

#### Lesson C: discriminated union + 単一 event 名

Supabase Broadcast は `event` 名でクライアント側 filter する設計だが、N 個の event 名を
増やすより 1 個の `haretoki:event` で `payload.kind` discriminator にした方が:
- subscriber は 1 回の `.on()` で全 kind 受信できる
- 新規 kind 追加で subscriber コード変更が最小 (switch に 1 ケース足すだけ)
- TypeScript の discriminated union が exhaustive check してくれる

trade-off: Supabase 側で「kind 別の発火回数」を可視化したい場合は payload を読む必要が
あるが、wave 1 段階では不要。

#### Lesson D: actor name resolver は React cache でメモ化

server action 1 回の中で `resolveActor(user.id)` を複数回呼ぶ可能性は低いが、saga 的に
複数の publish が連続するとき (例: makeDecision 内で venue 状態変更 + decision レコード
upsert + broadcast) に 1 query で済むよう React の `cache` で per-request メモ化。
副作用: テストでは `findUnique` mock を beforeEach で reset 必要。

---

## 12. 次の wave 着手前の TODO

- [x] `realtime.messages` の RLS policy migration → **wave 4 で完了**
  (`docs/phase3/realtime-rls-policy.sql`、Supabase dashboard で SQL editor 経由 apply)
- [x] broadcast 件数の admin dashboard 表示 → **wave 4 で完了**
  (`/admin/cost` の "Realtime broadcasts (7d)" セクション、`audit_log` の
  `realtime.broadcast.published` / `.failed` 行を per-kind 集計)
- [ ] 2 ブラウザでの実機 verify (dev で 1 回、prod deploy 後に 1 回) — launch checklist
- [ ] § 8 観測トリガーの数値収集 (1 ヶ月)
- [ ] **wave 5 候補**: client-side telemetry (subscribe count / 接続失敗率) を `/admin/cost`
  に wiring。今は scaffold (— 表示) のみ
- [ ] **wave 5 候補**: Realtime metric の長期 snapshot 化 (`AiCostSnapshot.dailyByBucket`
  Json に `realtime_broadcast` バケット追加、cron 拡張)

---

## 13. wave 4 (RLS + metric) 実装ログ

### 13.1 RLS policy 設計の選択判断

**結論**: Supabase Realtime Authorization の正規パターン (channel-level RLS via
`realtime.messages`) を採用。`channel.send` 側 (server publish) は service-role 経由なので
RLS bypass、`channel.subscribe` 側 (client) のみ gate する形。

**代替案と却下理由**:

| 案 | 却下理由 |
|---|---|
| (A) サーバー側で subscribe token を発行 / 検証 | Supabase Realtime にその hook がない、自前 WebSocket 実装が必要 |
| (B) channel name を hash で obfuscate (`project:sha256(uuid+secret)`) | 結局 broker 側で gate しないので「秘密 + 計算可能」、漏れたら無防備 |
| (C) RLS policy on `realtime.messages` (採用) | Supabase 公式パターン、policy が DB に居るので worker やデプロイに依存しない |

### 13.2 SQL の構造

`realtime.haretoki_project_member(uuid)` SECURITY DEFINER 関数で `auth.uid()` を
`project_members` に join、boolean を返す。policy は以下の式で channel name から
projectId を抜き出して関数を呼ぶ:

```sql
realtime.topic() LIKE 'project:%'
AND realtime.haretoki_project_member(
  split_part(realtime.topic(), ':', 2)::uuid
)
```

`split_part` で `:` 以降を取り、uuid cast。channel name が想定形式でなければ cast が
失敗して policy が false を返す (= deny) ので、攻撃側が `project:NaN` で bypass を狙う
余地もない。

### 13.3 metric 実装の選択判断

**結論**: 既存 `recordAudit()` を流用、`realtime.broadcast.published` /
`realtime.broadcast.failed` を `AuditAction` に追加して per-publish 1 row。

**代替案と却下理由**:

| 案 | 却下理由 |
|---|---|
| (A) 新規 `RealtimeBroadcastLog` Prisma model | schema 変更で B/C2 の wave 2/3 と衝突可能性、別 migration 増 |
| (B) PostHog server-side event のみ | dashboard で実数表示が要件、PostHog UI への外部リンクだけでは不十分 |
| (C) in-memory counter (process-local) | Vercel serverless で意味なし (コールドスタートでリセット) |
| (D) `AiCostSnapshot.dailyByBucket` Json に追加 | cron 修正必要、wave 4 スコープから外れる (wave 5 候補) |
| (E) `AuditLog` 流用 (採用) | schema 変更ゼロ、retention 既存 sweep で見られる、`(action, createdAt)` index 既存で query 高速 |

**懸念点**: AuditLog は本来「ユーザー / 管理者操作の append-only ログ」用途。broadcast を
1 publish 1 row で書くと AuditLog の用途が広がる。**判断**: broadcast は couple 平均 1 日
< 10 publishes、月間 < 300 row / couple。1000 couple でも月 30 万行で AuditLog 既存規模に
比して許容範囲。長期負担を避けるため § 12 wave 5 で長期 snapshot 化を計画。

### 13.4 publish.ts の構造変更

`publishRealtimeEvent` が成功した / 失敗したを `succeeded` boolean で持ち、`finally` の
後に **必ず** `recordAudit` を 1 回呼ぶ。失敗時は `detail.error` にメッセージを入れる。
`recordAudit` 自体が best-effort (Sentry-on-failure) なので、ここで throw は起きない。

`createAdminClient` が null を返すケース (env 未設定) は metric を記録しない — running
prod では env 必ず設定されている前提、dev / preview の env 不在でログを汚染しないため。

### 13.5 /admin/cost セクション設計

既存 dashboard (Anthropic cost / cache hit rate / tier history / snapshots) と同じ操作系
スタイル (border + tabular-nums、Editorial 系を使わない)。

セクション構成:
1. 4 セル grid: Total publishes / Failed publishes (& %) / Subscribe count (—) /
   Connection failure rate (—)
2. per-kind table: rating_saved / note_added / decision_made / wedding_date_updated /
   other (count + share %)
3. footnote: source SQL + wave 5 follow-up へのリンク

`other` バケット: 将来 RealtimeEvent kind が追加されて dashboard コードが追従する前の期間、
未知 kind を吸収して数字が消えないようにする safety net。

### 13.6 wave 4 lessons

#### Lesson E: schema 変更ゼロを最優先するなら AuditLog が射程内

新 model を作る前に「既存 model で済むか?」を必ず問う。AuditLog は append-only + 構造化
detail Json + 既存 retention があるので、metric を 1-event-1-row で乗せる用途に流用可能。
将来「分析クエリが重くなった」「retention horizon と合わない」時点で別 model に切り出せば
よく、**先に切り出すと wave スコープが膨らむ**。

#### Lesson F: subscribe / failure rate は client telemetry がないと測れない

publish 側だけ計測しても "subscribe する人がいるか / 接続失敗するか" は分からない。
client から server へ逆送する経路 (POST /api/realtime/heartbeat 等) が必要で、これは別
scaffold。wave 4 では明示的に scaffold (— 表示) のみで residue を残さず将来の wiring 場所を
固定。

#### Lesson G: RLS policy は SQL ファイルとして doc に置く (Prisma migrate に乗せない)

`realtime.*` schema は Supabase が所有。Prisma migrate でいじると次回 `prisma migrate dev`
で diff が壊れる。**docs/phase3/realtime-rls-policy.sql に置いて Supabase dashboard SQL
editor で実行する運用** が公式推奨。再実行可能 (idempotent) に書く。

#### Lesson H: 「2 ブラウザで verify」は launch checklist の必須項目

build pass / lint pass / test pass のいずれも broadcast の動作を保証しない。
Supabase Realtime の WebSocket 接続は実 socket layer の挙動なので、最低 1 回は 2 端末で
rating 保存 → 他端末 toast を目視確認しないと「動いている」と言えない。
`docs/phase3/COMPLETION.md` § 5 で必須項目化。
