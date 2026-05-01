# PENDING — 妻 200 点 → 商用化までの実装ロードマップ

## 全体構造

| Phase | 期間 | ゴール |
|---|---|---|
| **Phase 1: 妻 200 点 (W16-W21)** | 約 6 週間 | 妻が「これなら式場決められる」と言う UI/UX 完成度。商用化要件は封じる |
| **Phase 2: 商用化準備 (W22+)** | 別軸 | 公開・スケール・複数家族運用に耐える品質 |

## 妻 200 点 = 達成基準（6 軸）

| # | 軸 | 基準 |
|---|---|---|
| **A** | 体感速度 | 全タップ → 反応が **150ms 以内**（DESIGN.md P3）。venue 詳細・heart・rating・checklist で待ち感ゼロ |
| **B** | 視覚整合 | 全 14 画面で **DESIGN.md v4.2 editorial refresh 適用**、急に「20 年前」と感じる画面ゼロ |
| **C** | AI 入口 | **URL ペッ / PDF パッで自動入力**が機能。妻が手入力する場面ゼロ |
| **D** | 夫婦比較 | 妻の weights・評価・コメントが **画面で見える形で反映**。「私の意見どこ？」がない |
| **E** | 信頼性 | データ消失 / 誤削除 / 現地ネット死亡で記録消失がゼロ。エラー画面で詰まらない |
| **F** | 触覚 | 全タップに **active:scale + tactile feedback**、空ステート / loading / error が情緒的に整っている |

---

# Phase 1: 妻 200 点

## Sprint W16 — 体感速度の完全クリア（軸 A、約 5 営業日）

| ID | タスク | 出典 | 所要 |
|---|---|---|---|
| W16-1 | **venue 詳細 9 並列クエリに `use cache` + `cacheTag`** | performance-audit B-02 | 1-2 日 |
| W16-2 | **useOptimistic を heart / rating / checklist に導入** | performance-audit B-05 / Tier3 X-7 | 2 日 |
| W16-3 | **coach 画面 INP 300ms+ / CLS 0.15 解消** (typing animation 削除 + scroll 分割) | performance-audit B-06 | 1 日 |
| W16-4 | **explore filter INP 250ms 解消** (popLayout/stagger → useDeferredValue + motion layout) | performance-audit B-04 | 半日 |
| W16-5 | **revalidatePath → revalidateTag 細分化** (coach.ts、残箇所) | performance-audit B-08 | 半日 |
| W16-6 | **MotionProvider app-level 除去** (landing FCP 200-300ms 短縮) | performance-audit B-03 補完 | 半日 |
| W16-7 | **error.tsx 7 segment 補完** (coach/explore/candidates/compare/checklist/visits/mypage) | performance-audit B-11 | 半日 |

**達成判定**: LCP < 2.0s / INP < 180ms / CLS < 0.1 (Mobile)

## Sprint W17 — AI 入口の完成（軸 C）— ✅ 既に動作中（再確認の結果）

調査 (commit 696cc89 直後) で **両機能とも既に本実装が動いている** ことが判明:

- **URL 取込 AI 抽出**: `src/server/actions/venues.ts` の `addVenueFromUrl` →
  `confirmVenueFromUrl` パイプラインが Claude API を直接叩き、JSON-LD
  fallback まで含めて完全実装。`add-venue-sheet.tsx` から呼ばれている。
  当初疑った dead 状態 (prompt ファイルが孤立) は **別経路の inline prompt
  に置き換わっていた** だけで、機能としては成立。
- **見積もり PDF 解析**: `src/components/venues/estimate-pdf-upload.tsx` →
  `analyzeEstimatePdf` (estimates.ts) → `extractEstimateItems`
  (estimate-ai.ts) → Claude document-block API。`estimate-section.tsx`
  にマウント済み。これも完全実装。

副作用として 2 ファイルの dead code を削除:
- `src/lib/prompts/url-extraction.ts` (どこからも import されていない)
- `src/lib/prompts/estimate-analysis.ts` (同上)

これに伴い `docs/ai/prompts/README.md` を実態に合わせて更新
(inline prompt の存在を 📍 マークで明示)。

**達成判定**: 妻に URL / PDF を渡すだけで 80% 以上の項目が埋まる ✅
精度 tuning は Phase 2 (Release 2 AI Intelligence) のスコープ。

## Sprint W18 — 夫婦比較の正常化（軸 D、約 7 営業日）

| ID | タスク | 出典 | 所要 |
|---|---|---|---|
| ~~W18-1~~ | ~~**Partner weights を比較ボードに反映**~~ → ✅ 完了 (2026-04-30): `compare/page.tsx` で `getMyWeights` → `getCoupleWeights` に差し替え、`coupleWeights?.couple ?? null` を渡すだけ。型・signature 据え置き、JSDoc 全箇所同期 (`comparison-board` / `-grid` / `-mobile-snapper` / `-header-column`)。candidates と一貫した average 統合 | comparison-header-column.tsx:36 TODO | ✅ 完了 |
| W18-2 | **Partner Level 2 (6 次元星評価)** (妻が guest を脱して評価入れる) | roadmap R3 から抜粋 | 中 |
| ~~W18-3~~ | ~~**権限境界の明確化**~~ → 既に正しく実装済 (commit 確認済): `requireProjectMembership` は `role` 返却済、`requireOwner` 既存、個人データ (rating/note/favorite) は own-only ガード済、共有データは意図的に両方 OK。policy を `src/server/auth.ts` の冒頭コメントに明文化 | venues.ts (D-1 再判定) | ✅ 完了 |
| W18-3a | (旧 W18-3 の代わり) Partner Level 2 完了後に **destruction 系 (deleteVenue) の dual-confirmation** を検討 (Phase 2 商用化前) | — | 小 |
| ~~W18-4~~ | ~~**V-4: venue 詳細 action-bar 分岐**~~ → **unified 判定で完了** (2026-04-30): isFavorite で verb / destination が両方変わると couple が混乱するため、両 state「比べる」+ destination 統一。`venue-action-bar.tsx:35-39` のコメントで設計判断を明文化、audit-master-A V-4 行に反映 | audit-master-A V-4 | ✅ 完了 |
| ~~W18-5~~ | ~~**V-7: 見積項目 Combobox 化** (プリセット 40 種)~~ → ✅ 完了 (2026-04-30、並列セッション): estimate presets 55 件に拡張 + `defaultTier`、`tests/unit/lib/estimate-presets.test.ts` 5 件 GREEN (commit `051e673` / merge `979fda2`) | audit-master-A V-7 | ✅ 完了 |
| ~~W18-6~~ | ~~**V-9: 星評価 0.5 刻み水平バー + 楽観更新**~~ → ✅ 完了 (2026-04-30): 0.5 刻み水平バー + setRatings 楽観更新は既に実装済 (`rating-section.tsx` の `RatingBar` + `HALF_STEPS`)。W18-6 では `lastSavedRef` + 失敗時 dim-scoped rollback + `formErrors` 詳細エラートースト を追加 (commit `b7d19f4`)。並列セッションで useOptimistic 版 (`c673307`、ブランチ `feat/w18-rating-optimistic` で保存中) も試作されたが debounce + jsdom test で auto-revert が再現できず、Phase 2 課題 (React 19 transition + debounce + jsdom 検証) として一旦留め置き | audit-master-A V-9 | ✅ 完了 |
| ~~W18-7~~ | ~~**CMP-5: MatrixInsight AI 分析カード**~~ → ✅ 完了 (2026-04-30、並列セッション): `matrix-insight-card.tsx` 新規 + comparison-board に配置 + `compare/page.tsx` で SSR fetch (`getMatrixInsight().catch(() => null)`)、`tests/unit/components/comparison/matrix-insight-card.test.tsx` 3 件 GREEN (commit `a5da218` / merge `43fd0c8`) | audit-master-A CMP-5 | ✅ 完了 |

**達成判定**: 妻が比較ボードを見て「私の意見が反映されてる」「AI のおすすめが出る」と認識

## Sprint W19 — 視覚整合・最重要刷新（軸 B） ✅ 完了 prod 反映 (2026-04-30)

| ID | タスク | 出典 | 状態 |
|---|---|---|---|
| ~~W19-1~~ | ~~**mypage 大刷新**~~ → ✅ 完了: SettingsRow component 新規 (`src/components/mypage/settings-row.tsx`、unit test 5 件 GREEN)、More section の 3 つの個別 card を 1 つの divide-y list に統一、Profile / Partner も grid label で統一、`var(--hairline-gold)` token に置換、page-level rhythm `space-y-12` (commits `61918b0` + `ec8d9b2` / merge `4d61297`) | audit-sub-A4 P0-1 | ✅ 完了 |
| ~~W19-2~~ | ~~**44px タッチターゲット**~~ → ✅ 完了: `checklist-selection-view.tsx` + `review-estimate-edit-sheet.tsx` の sub-44px target を `min-h-11` に (commit `4a66f7c` / merge `f768af7`) | audit-sub-A4 P0-3 | ✅ 完了 |
| ~~W19-3~~ | ~~**way-home mood emoji → lucide icons + spring**~~ → ✅ 完了: `way-home-flow.tsx` で emoji 廃止 + Smile/Meh/Frown 等の lucide icon + spring tap style (commit `77db9a4`) | audit-sub-A4 P1-5 | ✅ 完了 |
| ~~W19-4~~ | ~~**icon token h-3 → h-4 全画面置換**~~ → ✅ 完了: 7 ファイル (journey/saved-searches/notifications/settings/checklist/visits-prep/back-link) の breadcrumb / arrow icons を統一 (commit `25ea3e6` / merge `f768af7`) | audit-sub-A4 P0-2 | ✅ 完了 |
| ~~W19-5~~ | ~~**copy-lexicon 違反置換** 19 箇所~~ → ✅ 完了: 13 ファイル 19 文字列を「残す / 手放す / 見学してみる」系に置換 (commit `fe682f4` / merge `726af46`) | copy-lexicon.md grep | ✅ 完了 |
| ~~W19-6~~ | ~~**急かしコピー削除**~~ → ✅ 完了: `ai-recommendations.tsx` の restore button から「今すぐ」系 pressure 文言を除去 (commit `892c248` / merge `726af46`) | audit-sub-A4 / copy-lexicon | ✅ 完了 |

**達成判定**: 全 14 画面で「急に古い」と感じない、コピーで急かされない ✅

## Sprint W20 — 見学体験 + データ信頼性（軸 E、約 5 営業日）

| ID | タスク | 出典 | 所要 |
|---|---|---|---|
| ~~W20-1~~ | ~~**見学メモ save の retry / offline queue**~~ → ✅ 完了 (2026-04-30): `src/lib/visit-note-queue.ts` (localStorage 上の versioned queue、SSR safe、defensive JSON parse)、visit-section.tsx の handleAddNote が失敗時に enqueue + Sonner toast に「もう一度送る」action、useOnlineStatus 復帰で auto-flush (flushingRef で Strict-mode 二重 flush 防止)。queue lib unit test 9 件 GREEN。photo / GPS の offline 戦略は W20-2 へ分離 (commit `031f4c0`) | コード調査 (F-2) | ✅ 完了 |
| W20-2 | **見学当日のクイックキャプチャ** (写真 + GPS + timestamp 自動付与) | roadmap R3 から抜粋 | 中 |
| W20-3 | **Soft delete 導入** (venue / visit / メモ / 評価。`deletedAt` カラム + filter) | コード調査 (B-2) | 中 |
| W20-4 | **アカウント合流時の重複 project ハンドリング正常化** (auto-discard 判定明確化 + 確認 UI) | invitation-links.ts (D-2) | 中 |
| W20-5 | **見学メモ orphan 画像クリーンアップ routine** | コード調査 (B-3) | 小 |

**達成判定**: 誤操作で消えるデータゼロ、見学現地で記録失敗ゼロ

## Sprint W21 — 触覚 / 細部仕上げ（軸 F、約 5 営業日）

W19 で残した editorial 細部 + マイクロインタラクション + 残バグ。

| ID | タスク | 出典 | 所要 |
|---|---|---|---|
| W21-1 | **login/signup hero motion 強化** (入場 motion + button 高さ 44px) | audit-sub-A4 残 | 中 |
| W21-2 | **checklist 細目刷新** (form spacing + 保存状態 inline) | audit-sub-A4 残 | 中 |
| W21-3 | **notification cluster 分離 + eyebrow** ("新着 / これまで") | audit-sub-A4 P0-4 | 小 |
| W21-4 | **SafeArea inset 漏れ 20 箇所修正** | audit-sub-A4 P2-10 | 中 |
| W21-5 | **dark mode opacity /30 → color-mix 修正** (4 画面) | audit-sub-A4 P2-9 | 小 |
| W21-6 | **Coach-8: セッション drawer + grouping** (履歴貼り付き解消) | audit-master-A Coach-8 | 中 |
| W21-7 | **比較ボードから venue 削除 UI** | コード調査 (A-1) | 小 |
| W21-8 | **比較グリッド sticky ラベル列** (375px 横スクロール時) | コード調査 (E-2) | 小 |
| W21-9 | **比較ボード戻り時の状態保存** (URL state) | コード調査 (F-5) | 小 |
| W21-10 | **Custom TODO 上限 UI 改善** (button + tooltip) | コード調査 (C-1) | 小 |
| W21-11 | **localStorage AI recommendations フラグ タイムアウト** | コード調査 (B-4) | 小 |

**達成判定**: 妻が「200 点。これで式場決める」と言う

---

# Phase 2: 商用化準備（W22+）

ここで初めて以下を本格化。Phase 1 で除外したものも、商用化に必要なら復活する。

## A. AI 機能の精緻化 (Release 2 相当)

- コーチチャットの応答品質 tuning
- 見積もり PDF 解析の精度 (document-block + 検証ロジック強化)
- 口コミ要約・比較分析・オンボ AI 推薦の prompt 改善
- ✅ **AI prompts md 化** (P2-AI-PROMPTS-MD, 2026-05-02 完了): onboarding / comparison / review-summary / url-extraction / estimate-extract — `docs/ai/prompts/<name>.system.md` で正本化、README.md を index 更新
- ✅ **AI prompts inline → モジュール化** (P2-PROMPTS-MD-ROUND2, 2026-05-02 完了): `URL_EXTRACTION_SYSTEM_PROMPT` / `ESTIMATE_EXTRACT_SYSTEM_PROMPT` を `src/lib/prompts/url-extraction.ts` / `src/lib/prompts/estimate-extract.ts` に切り出し済。caller (venues.ts / estimate-ai.ts) は import 経由
- ✅ **AI prompts md 化 (残)** (P2-PROMPTS-MD-ROUND2, 2026-05-02 完了): matrix-insight / fit-reason / ritual / vibe-suggest — 全 10 prompt の md 化が完了、README.md を 10 prompt 全載せ index に更新

## B. パートナー機能の完成 (Release 3 相当)

- Partner Level 3 (フルアプリ・全機能)
- Supabase Realtime によるリアルタイム同期 (複数端末)
- パートナー Push 通知

## C. 商用必須の周辺機能 (Release 4 から pick)

- 見学リマインダー通知システム
- ダークモード (Phase 1 では opacity 修正のみ)
- Google OAuth
- PWA + ServiceWorker (offline は Phase 1 W20 で部分対応済)
- OGP 画像生成 (W15 で部分実装あり)

## D. スケール対応

- AI コスト最適化 (キャッシュ戦略強化、input_hash 活用)
- バーチャルスクロール (式場が数十件以上)
- N+1 クエリ全数解消 (B-09 / B-16 の P2 残)
- prisma index 残 4 件追加 (B-10)
- next-intl 撤去 (B-17、未使用なら) or 多言語化 (i18n)

## E. Harness 自動化 (1 人開発から脱するとき)

- harness-ai-maintenance-plan Phase 2: drift 自動検知 hook (PostToolUse on prompts/anthropic.ts → md に stale)
- harness-ai-maintenance-plan Phase 3: docs-curator subagent — 🟡 spec ready (`.claude/agents/docs-curator.md`、Phase 2.E 2026-05-02 完成)。 cron / GitHub Actions 有効化は Phase 2 hook merge + 1 週観測後に判断
- ✅ ADR 導入 (`docs/harness/adr/`) — Phase 2.E 2026-05-02 完了。README + 0001-0005 の retroactive ADR 起票、runbook + CLAUDE.md cross-link
- MCP 運用 doc (`.claude/.mcp.json` 本実装)
- View Transitions API (Tier 3 X-9) — 🟡 foundation 投入済 (Phase 2.E 2026-05-02、ADR-0007)。`view-transition-name` 名前体系 (venue-card ↔ /venues/[id] 写真) + a11y reduced-motion fallback + MPA `@view-transition` の整理。SPA `experimental.viewTransition` flag は過去の mobile tab body-thrash 判断で false 維持。enable 条件は ADR-0007 §"Future enable 手順" 参照

## F. 残ハウスキーピング

- postcss / uuid 脆弱性 (transitive、Next.js / resend のメジャー upgrade 待ち)
- develop → main マージ → dependabot alerts auto-close

---

# 凡例

- 🔴 やるべき (推奨) / 🟡 判断保留 / 🟢 凍結 / ⏳ タイミング待ち

# 運用ルール

1. 新しい計画項目が出たら本ファイルに追加
2. やると決まったら該当行を削除し、`docs/plans/YYYY-MM-DD-<topic>.md` を作成
3. やらないと決まったら 🟢 マークに変更 + 取り下げ理由を 1 行
4. 月次見直し: 放置されている W## sprint があればチームで再判断
