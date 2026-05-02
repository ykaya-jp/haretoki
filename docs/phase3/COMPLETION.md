# Phase 3 — Completion Declaration

**完了日**: 2026-05-02
**作成**: 2026-05-02 (worker A、round 26)
**状態**: 🟢 **Phase 3 機能完成 — 商用化 launch checklist へ移行可**

> **読み方**: Phase 3 で何が動くようになったか + 何を有効化すれば本番運用できるかの
> 一枚もの。各機能の設計詳細は対応する `docs/phase3/*-design.md` を参照。
> 商用化に必要な前提条件 (RLS / Push subscribe / cron 設定) を § 3 にまとめてある。

---

## 0. 一行サマリー

**Phase 3 は couple 体験を「ふたりが同期する」レベルに引き上げた**。Partner が full
member として評価・メモ・決定に参加でき、片方の操作はもう片方の画面にリアルタイムで
toast + UI 即更新で届く。残るのは商用化 launch (Push 本格運用 / 多デバイス offline /
SLA 整備) のみ。

---

## 1. Level 1 — Partner guest 招待 (Phase 1 W15-F4 で完了済 → Phase 3 で運用観測)

### 機能
- Partner を guest mode で招待 (リンク発行、token 認証)
- Partner はプロジェクトの venue / estimate / decision を **read-only** で閲覧
- Partner 自身の rating / note は不可、weight 設定のみ可 (W18-1)

### 動作前提
- なし (auth 既存、token 単純)

### 関連 doc
- `docs/plans/2026-04-30-w15-f1-f4-impl.md` (W15 plan)
- `src/server/actions/invitation-links.ts`

---

## 2. Level 2 — Partner full member 昇格 (Phase 3 wave 1.x)

### 機能
- Partner は自分の **6 次元星評価** を編集可能 (`rating-section.tsx` viewer-aware 化)
- Partner は自分の **VisitNote** を編集可能 (own-only ガードは Phase 1 W18-3 で整備済)
- **Couple comparison surface** で owner + partner の評価を side-by-side 表示
  (`partner-comparison-summary.tsx` polish + dark-mode parity)
- Partner 初回 venue 訪問時に **「あなたも評価できます」hint** を 1 度だけ表示
  (`partner-can-rate-hint.tsx`、A-5 と同 pattern)
- `getCoupleRatings` (viewer-aware) で role-keyed double-count バグ修正
- analytics: `partner_rating_added` / `partner_rating_edited` /
  `couple_comparison_viewed` + `onboarding_partner_can_rate_seen|clicked|dismissed`

### 動作前提
- なし (schema 変更ゼロ、auth は Phase 1 で完備)
- analytics counts は `/admin/onboarding-funnel` の L2 セクションで scaffold 済 (実数 wiring は
  PostHog 経由 or 別 wave)

### 関連 doc
- `docs/phase3/partner-level-2-design.md` (L2 設計 + wave 1.x 実装ログ + lessons)

---

## 3. Level 3 — Realtime + 多デバイス sync (Phase 3 wave 1, 4)

### 機能
- **Supabase Realtime broadcast** で couple 間の semantic event を配信
  - `rating_saved` / `note_added` / `decision_made` / `wedding_date_updated`
  - 「{partner name}さんが評価を残しました」toast + 自動 router.refresh
  - actor 自己除外 + 5 秒 dedup window
- **CDC 経路** (`useRealtimeSync`) は既存維持 — broadcast と 2 層構成 (CDC: data 整合性、
  broadcast: 社会的シグナル)
- **broadcast metric** を `/admin/cost` の Realtime セクションで集計表示
  (kind 別 7 日件数 + failure rate)
- **RLS policy** SQL を `docs/phase3/realtime-rls-policy.sql` に整備済
  (Supabase dashboard で SQL editor 経由で apply)

### 動作前提 (商用化に必須)
- ✅ `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (既存)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (publish 経路で使用、env 設定済 — wave 1 で確認)
- 🟡 **`docs/phase3/realtime-rls-policy.sql` を Supabase dashboard で実行** ← launch 前に必須
  - 未実行のままだと UUID 知っているクライアントが他 couple の broadcast を subscribe 可能
  - 実行所要: SQL editor で 30 秒、idempotent
- 🟡 **2 ブラウザでの実機 verify** (1 couple、2 端末で rating 保存 → 他端末に toast)
  - dev 環境で 1 回、prod deploy 後にもう 1 回
- 🟡 wave 5 (Push 本格運用 + offline reconcile) は B/C2 worker が並走中

### 関連 doc
- `docs/phase3/partner-level-3-design.md` (L3 設計 + wave 1/4 実装ログ + § 11 設計差分)
- `docs/phase3/realtime-rls-policy.sql` (Supabase 適用 SQL)

---

## 4. Phase 3 で **ship しなかった** こと (Phase 4 持ち越し)

| 項目 | 理由 | 持ち越し先 |
|---|---|---|
| Push 通知 (couple activity) | wave 2 として B worker が実装中 | Phase 3 wave 2 (B 担当) |
| 多デバイス conflict resolution (VisitNote 楽観ロック) | 観測トリガー (同 visit 5 分以内 2 人編集 ≥ 5 件 / 月) 待ち | Phase 3 wave 3 (C2 担当) |
| Subscribe 数 / 接続失敗率の dashboard | client telemetry 機構が必要 | Phase 3 wave 5 (admin 経路は scaffold 済) |
| Owner / Partner が招待 / プロジェクト編集 / 最終決定 を双方できる | "couple として 2 人で決めた感" を維持するため意図的に owner-only | 計画なし (設計判断) |
| Realtime metric を 1 週間 snapshot 化 | 既存 audit_log 7 日 query で足りているが、長期トレンドが必要なら | Phase 4 / Phase 3 wave 5 |

---

## 5. 商用化 launch checklist (Phase 3 関連)

> 以下は Phase 3 が動くために必要な launch 前作業。商用化 launch 全体 checklist は
> `docs/PENDING.md` を参照 (auth / payment / SLA / CS など全領域)。

### 必須 (本番 deploy 前にすべて ✅)

- [ ] `docs/phase3/realtime-rls-policy.sql` を **本番 Supabase dashboard** で実行
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が **本番 env** に設定されていることを確認
  (Vercel project settings → Environment Variables)
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` が本番 env 設定済
  (B-1 Push 基盤、wave 2 で本格利用)
- [ ] Vercel cron が稼働: `/api/cron/ai-cost-summary` (daily) /
  `/api/cron/data-retention-sweep` (daily) / `/api/cron/email-suppression-retry` (daily)
- [ ] `ADMIN_EMAILS` に本番運用者の email を設定 (`/admin/cost` 含むダッシュボード閲覧権)
- [ ] 2 ブラウザでの Realtime 実機 verify:
  - [ ] dev / preview で 1 回 (rating 保存 → 他端末 toast 確認)
  - [ ] prod alias swap 後にもう 1 回

### 推奨 (1 週間以内に対応)

- [ ] `/admin/cost` の Realtime セクションで `failed publishes` が 0 % であることを 1 週間モニタリング
- [ ] `/admin/onboarding-funnel` L2 セクションで `partner_rating_added` が couple ごとに発火しているか PostHog で確認
- [ ] L3 wave 5 (Push 本格運用 + Subscribe metrics) の B/C2 進捗確認
- [ ] L3 § 8 観測トリガー (`couple_comparison_viewed` repeat 率 / owner→partner add 時間差 / 同 visit 同時編集) の数字収集開始

### 任意 (改善ループ)

- [ ] Onboarding-recs prompt に couple sync を踏まえた diversity 追加 (Phase 3 wave optional)
- [ ] Realtime metric の長期 snapshot 化 (既存 `AiCostSnapshot.dailyByBucket` Json に
  `realtime_broadcast` バケット追加、cron 拡張)

---

## 6. roll-back シナリオ

| 障害 | 対応 |
|---|---|
| Realtime broadcast が flood して Supabase 接続上限を圧迫 | `publishRealtimeEvent` に return; 1 行追加で全 publish 停止。CDC 経路 (`useRealtimeSync`) は影響なし、データ整合性は保たれる |
| RLS policy が誤適用で全 broadcast が SELECT permission denied | `realtime-rls-policy.sql` の DROP POLICY 部分のみ実行で wave 1 状態に巻き戻し (security through obscurity 状態) |
| Partner full member 化で UX 不具合発生 | `getCoupleRatings` を旧 `getPartnerRatings` shape に戻す路線は thin proxy 削除後なので不可、但し UI 側で `otherRatings` の render を hide すれば guest 同等に縮退可 |
| Push 通知の opt-in が想定外に低い | wave 2 で実装、wave 5 で観測 — ここで判断材料が揃う |

---

## 7. メトリクス (Phase 3 完成時 baseline)

> 本セクションは launch 後 1 週間で実数を埋め、wave 5 着手判断の基準とする。

| メトリクス | source | baseline | 目標 |
|---|---|---|---|
| Realtime broadcast 数 (7d) | `/admin/cost` | (launch 後測定) | 1 active couple あたり 50-200 publishes |
| Realtime failure rate | 同上 | (launch 後測定) | < 1 % |
| `partner_rating_added` (per couple) | `/admin/onboarding-funnel` L2 | (PostHog) | 60 % 以上の couple が partner-add ≥ 1 |
| `couple_comparison_viewed` (per venue) | 同上 | (PostHog) | comparison surface 開く couple ≥ 40 % |
| Owner / partner エンゲージメント比 | rating count (owner) / rating count (partner) | (DB query) | 1.0 - 3.0 (倒れすぎていない) |

---

## 8. 関連ドキュメント

- `docs/phase3/partner-level-2-design.md` — L2 設計 + 実装ログ + lessons
- `docs/phase3/partner-level-3-design.md` — L3 設計 + wave 1/4 実装ログ + lessons
- `docs/phase3/realtime-rls-policy.sql` — wave 4 RLS policy (Supabase dashboard 適用 SQL)
- `docs/roadmap.md` — Release 1-4 統合ロードマップ
- `docs/PENDING.md` — 商用化全領域 checklist
- `src/lib/realtime/` — broadcast scaffold (events.ts / publish.ts / use-realtime-project.tsx)
- `src/components/realtime-provider.tsx` — CDC + broadcast 併走 mount

---

## 9. 履歴

- 2026-05-02 (round 22): Phase 3 計画 (L2 設計 doc 初版)
- 2026-05-02 (round 23-24): L2 wave 1.1〜1.5 実装 (paneA + paneC2)
- 2026-05-02 (round 25): L3 wave 1 (Realtime broadcast scaffold) 実装 (paneA)
- 2026-05-02 (round 26): L3 wave 4 (RLS + metric) + 本完了宣言 (paneA)
- (今後) wave 2 (Push 本格運用) by B、wave 3 (offline reconcile) by C2
