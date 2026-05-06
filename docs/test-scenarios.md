# Test Scenarios — haretoki

> 主要 user scenario と edge case の網羅マトリクス。実装と test の鏡として使う。
> 凡例: **Coverage** カラムは scenario をカバーする test ファイルを示す。
> - `unit:` → `tests/unit/**`
> - `integration:` → `tests/integration/**`
> - `e2e:` → `tests/e2e/**`
> - `manual:` → 自動化なし、リリース前に手動確認

カテゴリ:
1. [Onboarding & First-time user](#1-onboarding--first-time-user) — 新規 signup → 初回体験
2. [Venue add & explore](#2-venue-add--explore) — URL取込 / 手動追加 / 検索 / 詳細閲覧
3. [Comparison & decision](#3-comparison--decision) — 比較 / pros-cons / 最終決定
4. [Wrapped & magic features](#4-wrapped--magic-features) — Wrapped / Coach / Insight 系
5. [Edge cases & failure modes](#5-edge-cases--failure-modes) — AI 失敗 / cold-start / 入力異常
6. [Cross-cutting concerns](#6-cross-cutting-concerns) — モバイル / a11y / dark mode / SafeArea / perf

設計指針:
- **scenario ID は immutable**。テストや UI 変更でも ID は変えない。Coverage カラムを更新する
- 1 scenario 1 行原則。複数の expectation を `;` でなく別 scenario に分ける
- "Coverage" は最低 1 つの自動化 test または `manual` を必ず埋める。空欄禁止
- 新機能を追加するときは、まずこの doc に scenario を書く (TDD の前段)

---

## 1. Onboarding & First-time user

| ID    | Scenario                                                                   | Expected                                                                                            | Coverage                                                                                                       |
|-------|----------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| S1.1  | 新規 signup → onboarding 4 質問 → /home に着地                              | venuesCount=0、AIRec primed state、PreferencePulseCard hidden                                       | e2e: `user-journey.spec.ts`、e2e: `onboarding.spec.ts`、unit: `onboarding.test.ts`                              |
| S1.2  | onboarding 途中で離脱 → 再ログインで途中再開                                | 入力済 step が prefilled、続きから再開可能                                                          | unit: `onboarding.test.ts`                                                                                     |
| S1.3  | onboarding 完了直後に Claude rec が auto-populate                          | 推奨 venue 3-5 件を /home の AI rec カードで表示                                                    | unit: `ai-recommendations-gating.test.ts`                                                                      |
| S1.4  | onboarding skip して直接 /home                                              | conditions=null state、coach から「条件を教えて」hint                                               | unit: `onboarding.test.ts`、e2e: `onboarding.spec.ts`                                                          |
| S1.5  | onboarding 後 cold-start (favorite/visit 0) → preference vector cold:true | summarizePreferenceVector → null、onboarding-recs は declared conditions のみ                       | integration: `preference-coach-pipeline.integration.test.ts` (cold-start case)                                 |
| S1.6  | URL 貼付で signup 前に登録試行 → auth gate                                  | auth redirect → /sign-in、signup 後に originally-pasted URL が pre-fill                              | e2e: `auth-flow.spec.ts`                                                                                       |
| S1.7  | guest invite link → onboarding 不要で直接 venue board                       | invite token 有効、guest mode で read-only Venue 一覧                                               | e2e: `invite-guest-mode-smoke.spec.ts`、e2e: `invite-flow.spec.ts`                                              |

## 2. Venue add & explore

| ID    | Scenario                                                                  | Expected                                                                                  | Coverage                                                                                            |
|-------|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| S2.1  | URL 貼り付け (ゼクシィ) → 詳細遷移                                          | venueId 渡る、写真保存、自動 nav、Venue 行作成                                              | e2e: `user-journey.spec.ts`、unit: `venues-refresh.test.ts`                                          |
| S2.2  | URL 貼り付け (Wedding Park) → 詳細遷移                                      | 同上、ただし source=wedding_park                                                            | unit: `venues-refresh.test.ts`、manual                                                              |
| S2.3  | URL 取込で 5 venues batch import → 一覧で表示                              | summary {saved:5, skipped:0, failed:0}、各 venue が一覧に出現                              | unit: `batch-import-review-urls.test.ts`、manual                                                    |
| S2.4  | 手動 venue 追加 (フォーム入力)                                              | venueId 生成、/venues/[id] 遷移、OG 画像生成                                               | unit: `venues-refresh.test.ts`、e2e: `pages.spec.ts`                                                 |
| S2.5  | venue 詳細ページ → 写真 carousel スワイプ                                   | photoUrls の N 枚表示、scroll-snap-x 効く                                                  | manual (375px)                                                                                      |
| S2.6  | venue を Heart で候補追加                                                   | VenueFavorite row 作成、トースト「候補に追加しました」、/favorites に出現                    | unit: `favorites-toggle.test.ts`、e2e: `user-journey.spec.ts`                                        |
| S2.7  | venue 検索 / フィルタ (エリア・予算・スタイル)                             | filter チップ反映、結果 venue list 更新、空結果なら CTA                                     | unit: `venue-filters.test.ts`、e2e: `explore-filter-resync.spec.ts`                                  |
| S2.8  | 重複 URL 取込 → dedup で skip                                                | summary {saved:0, skipped:N, failed:0}、トースト「既に取り込み済」                          | unit: `batch-import-review-urls.test.ts` (dedup case)                                               |
| S2.9  | venue name 部分一致検索                                                    | 全角ひらがな・カタカナ・漢字いずれの入力でも match                                          | e2e: `venue-name-search-smoke.spec.ts`                                                              |
| S2.10 | venue 詳細の必須フィールド 7 つ全表示 (location, capacity, cost, ...)      | venue-detail-shape の contract 維持                                                       | e2e: `venue-detail-shape.spec.ts`                                                                   |
| S2.11 | explore tab で virtual scroll (50+ venues)                                | virtual-scroll で off-screen 行は un-render、tap で安定遷移                                | e2e: `explore-virtual-scroll.spec.ts`                                                               |
| S2.12 | venue 削除 (soft delete: deletedAt set)                                    | 一覧から消える、preference vector / wrapped から除外                                       | unit: `venues-refresh.test.ts`、integration: `preference-coach-pipeline.integration.test.ts` (削除考慮) |

## 3. Comparison & decision

| ID    | Scenario                                                                                | Expected                                                                                | Coverage                                                                                            |
|-------|-----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| S3.1  | 2 件 favorite → /compare → matrix 表示                                                  | matrix.venues.length=2、Pros/Cons 表示                                                  | integration: `comparison-flow.integration.test.ts` (chain)                                          |
| S3.2  | 2 件 favorite → matrixIds → getComparisonMatrix の id 順保持                            | venues の order が caller request 通り                                                  | integration: `comparison-flow.integration.test.ts` (preserve-order)                                 |
| S3.3  | 11+ 件 favorite → 自動で COMPARE_MAX_VENUES=10 にクランプ                                | venues.length=10、UI トースト「比較は最大 10 件」                                       | unit: `compare-matrix.test.ts` (clamp case)                                                         |
| S3.4  | partner 招待 + 4 venues + per-dim ratings → disagreement spotlight 表示                | top-3 delta ≥ 1.0 が venueName/dimension/owner/partner 付きで返る                      | integration: `disagreement-spotlight.integration.test.ts` (top-3 case)                              |
| S3.5  | solo project (1 member) → disagreement spotlight 非表示                                | result=[]、prisma.visitRating.findMany 呼ばれず                                         | integration: `disagreement-spotlight.integration.test.ts` (solo case)                               |
| S3.6  | 1 venue を 4 dimension で評価 → spotlight は venue ごとに 1 行                           | 同 venue で複数 dim 出ない (venue × max-delta dim のみ)                                 | integration: `disagreement-spotlight.integration.test.ts` (one-row-per-venue)                       |
| S3.7  | venue scores → deriveProsCons (≥4.0/≤2.5)                                               | pros=[cuisine, ceremony]、cons=[cost_contract]、中間スコアは除外                        | integration: `comparison-flow.integration.test.ts` (pros/cons)                                      |
| S3.8  | matrix winners.total → /compare で同 venueId をハイライト                                | winners[id] が compare.venues に必ず含まれる                                            | integration: `comparison-flow.integration.test.ts` (winners-survival)                               |
| S3.9  | 「決める」ボタン押下 → Decision 行作成                                                   | Decision 1 件、Wrapped が hasStory:true、coach が countdown lane へ                    | unit: `decisions-wedding-date.test.ts`、integration: `preference-coach-pipeline.integration.test.ts` (decision)|
| S3.10 | matrix totalScore は 8 TIER1 dim 平均、null は除外                                      | 4 dim 入力なら sum/4、未入力 dim は null (0 ではない)                                   | integration: `comparison-flow.integration.test.ts` (totalScore)                                     |
| S3.11 | swipe 比較 (mobile gesture)                                                            | 2 venue を左右 swipe で切替、scroll-snap-x mandatory                                    | e2e: `swipe-compare.spec.ts`                                                                        |
| S3.12 | compare tab 全体スモーク                                                               | 主要要素 (matrix, pros/cons, disagreement) すべて render                                | e2e: `compare-tab.spec.ts`                                                                          |
| S3.13 | decision share OG 画像生成                                                             | /og/decision/[id] が PNG 200 を返す                                                     | unit: `og-decision-scene.test.ts`、e2e: `decision-share.spec.ts`                                    |
| S3.14 | 決定後にもう一度比較ページ閲覧                                                          | Decision 表示済バナー、「変更する」CTA                                                  | manual + e2e: `decision-share.spec.ts`                                                              |
| S3.15 | partner と評価が完全一致 → disagreement 非表示 (delta=0)                                | result=[]、UI でも空ステート                                                            | integration: `disagreement-spotlight.integration.test.ts` (filtered <1.0)                           |

## 4. Wrapped & magic features

| ID    | Scenario                                                            | Expected                                                                          | Coverage                                                                            |
|-------|---------------------------------------------------------------------|-----------------------------------------------------------------------------------|-------------------------------------------------------------------------------------|
| S4.1  | venues > 0 → /wrapped で 5-page 物語                                | hasStory:true、5 数値 + topVibes/topAreas 表示                                    | integration: `wrapped-aggregation.integration.test.ts` (5-signal)                   |
| S4.2  | 3 venues + favorites + visits → topVibes 上位 3 件                  | natural / elegant / modern 等の頻度順、location 6字 prefix で areaKey             | integration: `wrapped-aggregation.integration.test.ts` (topK)                       |
| S4.3  | empty project (venues 0, decision なし) → Wrapped zero-state copy   | hasStory:false、「まだはじまったばかり」表示                                        | integration: `wrapped-aggregation.integration.test.ts` (empty)                      |
| S4.4  | venues 3 件中 1 件は import-only (heart/visit なし) → engaged=2     | venuesAdded=3、venuesEngaged=2 (import-only は除外)                              | integration: `wrapped-aggregation.integration.test.ts` (engaged)                    |
| S4.5  | Coach proactive suggestions: favorite + visit + estimate 各 path    | 各 path で正しい suggestion id (compare-top-favorites / favorite-without-visit 等)| integration: `preference-coach-pipeline.integration.test.ts` (cases)                |
| S4.6  | matrix-review-insight: 2+ venues with reviews → Claude synthesise   | commonConcerns / divergence / decisionHint、fallback:false                         | integration: `cycle1-r1-r2-r3-pipeline.integration.test.ts` (R3 success)            |
| S4.7  | review cluster 表示 (R1+R2+R3 chain)                               | 各 venue の summary / strengths / concerns が UI rendering                       | e2e: `review-cluster.spec.ts`、integration: `cycle1-r1-r2-r3-pipeline.integration.test.ts` |
| S4.8  | coach に send (text)                                                | assistant 応答が streaming で描画される                                            | manual (本番スモーク必須)                                                          |
| S4.9  | wrapped → decided venue がある時 5 page 目で venue name 表示        | decidedVenueName を hero text で表示                                              | integration: `wrapped-aggregation.integration.test.ts` (5-signal case)              |
| S4.10 | wrapped → decision のみ存在 (venues 0) で hasStory:true              | edge case: venues 0 でも decision 1 件あれば物語成立                              | integration: `wrapped-aggregation.integration.test.ts` (decision-alone case)        |

## 5. Edge cases & failure modes

| ID    | Scenario                                                                  | Expected                                                                              | Coverage                                                                                            |
|-------|---------------------------------------------------------------------------|---------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| S5.1  | Claude API 失敗 → AI rec auto-retry → 2 fail で人間 hint                  | retry 1, error state attempts=2、トースト「AIが手を上げた」                          | unit: `ai-recommendations-gating.test.ts`、unit: 各 ai action                                       |
| S5.2  | Cold-start (Visit 0) → preference vector cold:true                        | summarizePreferenceVector → null、onboarding は declared conditions のみ              | integration: `preference-coach-pipeline.integration.test.ts` (cold case)                            |
| S5.3  | Claude が malformed JSON 返す → template fallback                          | warnings=[]、fallback:true、render は空にならない                                     | unit: `estimate-warnings.test.ts`、unit: `get-matrix-review-insight.test.ts`、integration: `cycle1-r1-r2-r3-pipeline.integration.test.ts` (R3 fallback) |
| S5.4  | URL 取込 rate-limit (5/min 超過) → reject                                  | error: 「取り込みの頻度が高すぎます。N秒後に〜」                                       | unit: `batch-import-review-urls.test.ts` (rate-limit)                                               |
| S5.5  | URL 取込で disallowed domain (example.com 等) → fail                       | per-URL status:failed、message:「対応していない…」、loop 継続で他 URL は処理         | unit: `batch-import-review-urls.test.ts` (allowlist)                                                |
| S5.6  | URL 取込で http:// (non-HTTPS) → fail                                     | per-URL status:failed、message:「HTTPS の URL のみ」                                  | unit: `batch-import-review-urls.test.ts` (scheme)                                                   |
| S5.7  | matrix-review-insight: venues < 2 → null 返却 (no surface)                | result=null、Claude 呼ばれず、DB にも触らない                                         | integration: `cycle1-r1-r2-r3-pipeline.integration.test.ts` (R3 < 2)                                |
| S5.8  | matrix-review-insight: 全 venue が review 0 → null 返却 (no hallucination)| result=null、Claude 呼ばれず                                                          | integration: `cycle1-r1-r2-r3-pipeline.integration.test.ts` (R3 zero reviews)                       |
| S5.9  | partner-half-rated venue → disagreement に出ない                           | 片方しか評価していない venue は spotlight 候補外                                      | integration: `disagreement-spotlight.integration.test.ts` (skip-half)                               |
| S5.10 | venueId が他人の project → ownership check で reject                       | error:「式場が見つかりません」、rate-limit 消費せず                                    | unit: `batch-import-review-urls.test.ts` (ownership)                                                |
| S5.11 | URL 取込 zod cap (>10 URL) → reject                                        | error:「10件まで」、rate-limit / DB 消費せず                                          | unit: `batch-import-review-urls.test.ts` (zod cap)                                                  |
| S5.12 | empty / non-URL string 入力 → zod reject                                  | per-URL status:failed もしくは入口で error                                            | unit: `batch-import-review-urls.test.ts` (empty / invalid)                                          |
| S5.13 | error boundary (page.tsx 例外) → app/error.tsx 表示                       | 「予期しないエラーが起きました」+ 再試行 CTA                                          | e2e: `error-boundaries.spec.ts`                                                                     |
| S5.14 | 空ステート (favorites 0, venues 0) coverage 全画面                         | empty-state copy + CTA を全主要 route で表示                                          | e2e: `empty-state-coverage.spec.ts`                                                                 |
| S5.15 | Claude unavailable (API key 無し) → matrix-review-insight fallback        | template fallback で divergence は populated、Claude 呼ばれず、cache write なし       | integration: `cycle1-r1-r2-r3-pipeline.integration.test.ts` (R3 unavailable)                        |

## 6. Cross-cutting concerns

| ID    | Scenario                                                            | Expected                                                                  | Coverage                                                  |
|-------|---------------------------------------------------------------------|---------------------------------------------------------------------------|-----------------------------------------------------------|
| S6.1  | iOS Safe Area inset → BottomNav が home indicator に被らない          | env(safe-area-inset-bottom) applied、ボタン全押下可                       | manual (iOS Safari 375px)                                 |
| S6.2  | Dark mode → main 7 surfaces parity                                  | theme switching で全 surface が dark token に切替                          | e2e: `mobile-ux.spec.ts`、manual                          |
| S6.3  | 375px mobile width → fixed 要素 (FAB, ChatBar) ビューポート内        | はみ出し / 重なり / 折り返しなし                                           | manual (DevTools mobile emulation)                        |
| S6.4  | タッチターゲット 44px (h-11) ルール                                   | shadcn/ui default の上書きが効く、全 button 44px 以上                     | manual + 設計レビュー                                     |
| S6.5  | ローディング状態 (Server Component 遷移)                             | 各 route の loading.tsx が表示、白画面なし                                | manual                                                    |
| S6.6  | エラーバウンダリ (page.tsx → error.tsx)                              | 例外発生時に `(app)/error.tsx` が表示、再試行ボタン                       | e2e: `error-boundaries.spec.ts`                           |
| S6.7  | ネットワーク slow-3G で初期表示 → スケルトン表示                      | LCP < 4s、main content が見えるまでスケルトン                             | manual (Lighthouse)                                       |
| S6.8  | 用語の一貫性 (UI: 候補 / コード: VenueFavorite 等)                   | UI コピーに「ショートリスト」など旧語が出現しないこと                      | e2e: `terminology.spec.ts`                                |
| S6.9  | 全 5 main 画面を navigation で順次タップ                              | 各 tab で h1 が見える、白画面 / 404 ナシ                                  | e2e: `navigation.spec.ts`、e2e: `comprehensive-app-smoke.spec.ts`|
| S6.10 | landing page (未ログイン)                                           | h1 + CTA が見える、Lighthouse perf score ≥ 70                            | e2e: `landing.spec.ts`、manual                            |
| S6.11 | mobile UX 統合スモーク (375px)                                      | scroll-snap, touch target, safe-area-inset 主要 page で OK                | e2e: `mobile-ux.spec.ts`                                  |
| S6.12 | prod 環境 QA スモーク                                                | 本番固有の env, 認証, セッション fix で 5 page render                      | e2e: `prod-qa-smoke.spec.ts`                              |

---

## カバレッジ サマリ

| カテゴリ                    | scenarios | unit cover | integration cover | e2e cover | manual only |
|-----------------------------|----------:|-----------:|------------------:|----------:|------------:|
| 1. Onboarding               |         7 |          3 |                 1 |         5 |           0 |
| 2. Venue add & explore      |        12 |          7 |                 1 |         7 |           4 |
| 3. Comparison & decision    |        15 |          3 |                 9 |         5 |           1 |
| 4. Wrapped & magic features |        10 |          0 |                 7 |         2 |           1 |
| 5. Edge cases & failures    |        15 |         11 |                 6 |         2 |           0 |
| 6. Cross-cutting            |        12 |          0 |                 0 |         8 |           7 |
| **合計**                    |    **71** |     **24** |            **24** |    **29** |      **13** |

> 1 scenario が複数 layer (unit + integration + e2e) で覆われている場合は重複カウント。

**ギャップ**:
- カテゴリ 6 (cross-cutting) が manual 主体 → visual regression test 拡充候補
- カテゴリ 2 の URL 取込 happy-path (S2.3) は unit + manual のみ。integration test で analyze chain の shape 固定検討
- AI fallback (S5.1) の retry 回数を E2E でも確認すると安心感アップ
- swipe 比較 (S3.11) は 1 e2e に依存。 mobile real device での gesture テスト未自動化

## メンテナンス指針

1. **新機能追加** → 該当カテゴリに scenario を追記し、Coverage カラムを埋める
2. **scenario が ID として参照されている test を変更** → 本ドキュメントの Coverage カラムも同 PR で更新
3. **新カテゴリ作成** → カバレッジ サマリ表にも行追加
4. **Coverage が `manual` のままの scenario** → 自動化候補。リリース前のチェックリストに残す
5. **scenario の削除** → ID は再利用しない (S3.6 を消したら S3.16 から続ける)。後続の test changelog 追跡を壊さないため

## Cycle 別 Test Plan (実装フェーズ別)

### Cycle 1 — Review pipeline (R1 + R2 + R3)
- S2.3 (URL batch import), S2.8 (dedup)
- S5.4 - S5.6, S5.10 - S5.12 (URL 取込 edge cases)
- S4.6 - S4.7 (matrix-review-insight)
- S5.7, S5.8, S5.15 (R3 no-surface / fallback)
- カバー file: `cycle1-r1-r2-r3-pipeline.integration.test.ts`、`batch-import-review-urls.test.ts`、`get-review-summaries-for-venues.test.ts`、`get-matrix-review-insight.test.ts`

### Cycle 2 — Disagreement spotlight + comparison
- S3.4 - S3.6, S3.15 (disagreement)
- S3.1, S3.2, S3.7, S3.8, S3.10 (comparison chain)
- カバー file: `disagreement-spotlight.integration.test.ts`、`comparison-flow.integration.test.ts`

### Cycle 3 — Wrapped + Coach magic
- S4.1 - S4.5, S4.9, S4.10 (wrapped)
- S1.5, S5.2 (preference vector cold-start)
- カバー file: `wrapped-aggregation.integration.test.ts`、`preference-coach-pipeline.integration.test.ts`

## 動的スモーク チェックリスト (deploy 前)

CRITICAL: lint/tsc/test pass は完了条件ではない。本番と同じ条件で実機 (mobile 375px Safari emulation) で叩いてからしか deploy しない。

- [ ] フォーム保存 (見積もり / 評価 / URL 追加) → 成功トースト
- [ ] URL 取込で実在公開 URL (ゼクシィ等) を 1 件取込 → Venue 出現
- [ ] AI チャット 1 往復 → assistant 応答が描画される
- [ ] 全 5 タブ (ホーム / 探す / 候補 / コーチ / マイページ) tap → h1 見える
- [ ] mobile 375px で fixed 要素 (BottomNav / FAB / ChatBar) が完全にビューポート内
- [ ] 新 route 追加時は `next.config.ts` の legacy redirects に source が無いか確認

> 関連ドキュメント
> - [tests/PENDING.md](../tests/PENDING.md) — 既知の保留 / skip 中の test
> - [DESIGN.md](../DESIGN.md) — UI/UX の真実源、scenario の "Expected" 列の妥当性チェックに使う
> - [docs/roadmap.md](./roadmap.md) — 機能スコープと scenario の対応
> - [AGENTS.md](../AGENTS.md) — AI agent 向け Task Completion Checklist (lint / tsc / test / 375px / docs 同期)
