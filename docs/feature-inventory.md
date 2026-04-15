# Haretoki 機能インベントリ（2026-04-14 時点）

> 結婚式場比較アプリ Haretoki の現況棚卸。機能、品質、既知課題、進化方針をまとめたドキュメント。
>
> 出典: `CLAUDE.md`, `docs/myreview/remediation-master-plan.md`, `docs/myreview/problems_01.md`, `docs/roadmap.md`, `docs/superpowers/specs/*`, `docs/lessons.md`, Prisma schema, `src/app/**`, `src/server/actions/**`

---

## 1. サマリ

### 実装状況（2026-04-14）
- **本番稼働画面**: 10（ホーム / 探す / 候補 / コーチ / 式場詳細 / オンボーディング / パートナー招待 / マイページ / 設定 / デモ）
- **Phase 0 完了**: 2026-04-14 当日 — DB マイグレ適用、AI API 再稼働、「うまくいきませんでした」系エラー解消
- **Phase 1 進行中**: P1-1/2/3/4/6/7 完了、develop マージ済み（本ファイル作成時点）

### 品質ステータス
- **安定度**: Phase 0 までで主要動線は 🟢、一部 🟡（コーチのセッション管理、R2 待ち機能）
- **完成度**: A 評価（主要機能充足。R1 範囲で AI は URL 解析のみ、他は R2+）

### 次フェーズの焦点
1. **Phase 1 残り検証 + ship** — モバイル実機で LCP < 1.8s / タブ切替 < 500ms を計測
2. **Phase 2（IA 再設計）** — ホーム NBA 統合、探す FAB、式場詳細タブ化、コーチセッション方式
3. **Phase 3（ビジュアル刷新）** — 明朝×サンセリフ対比、gold-subtle グラデ、View Transitions 本格活用
4. **Phase 4（仕上げ）** — コピー統一、ダークモード、計測（Core Web Vitals / Vercel Analytics）

---

## 2. 機能マップ（画面別）

| 画面 | ルート | 主要機能 | 安定度 | 完成度 | テスト | 既知課題 | 次の進化 |
|---|---|---|---|---|---|---|---|
| ホーム | `/(app)/home` | AIインサイトカード / 進捗リング / 最近見た式場 / 次の一歩 CTA | 🟢 | A | ✓ | ホーム#1-7（改行・押せないボタン列・比較エラー・モダンでない） | Phase 2: NBA 1カード化 / Phase 3: bento + gold グラデ |
| 探す | `/(app)/explore` | 式場ブラウズ / フィルタチップ / URL・手動追加 / AI おすすめ | 🟡 | A | ✓ | 探す#8-16（追加ボタン地味・URL解析失敗→H0-2済・タブ構造・縦並び） | Phase 2: FAB / 段階 BottomSheet / 式場詳細タブ化 |
| 候補 | `/(app)/candidates` | VenueFavorite 一覧 / 比較ボード（QuickLook, DimensionBar） / 最終決定 | 🟢 | A | ✓ | 候補#1（うまくいきません → H0-1 済） | Phase 1 完了 / Phase 2: W-4 写真横並び |
| コーチ | `/(app)/coach` | AIインサイトフィード / チャットバー（定型 FAQ） / ストリーミング SSE | 🟡 | B | ～ | コーチ#1-2（過去チャット残留・比較エラー→H0-1済） | Phase 2: セッション履歴サイドバー / R2: Claude 自由対話 |
| 式場詳細 | `/(app)/venues/[id]` | 写真カルーセル / 基本情報 / 6次元星評価 auto-save / 見積もり / 訪問記録 / 口コミ | 🟡 | A | ✓ | 探す#14（ラベル書式・星更新失敗→H0-5済・縦ボタン羅列・プリセット無） | Phase 2: タブ化（概要/見積/訪問/口コミ）+ プリセット + 自由入力 |
| オンボーディング | `/(app)/onboarding` | AI 対話 3-4 問 / 条件保存 / AI おすすめ | 🟡 | B | ✓ | 探す#13（AIおすすめ固まる→H0-2済） | R2: Claude ベース推薦 |
| パートナー招待 | `/(app)/accept-invite` | ゲストビュー / 👍🤔👎 リアクション / サインアップ CTA | 🟢 | A | ✓ | なし | R3: Realtime 同期 / Level 2-3 |
| マイページ | `/(app)/mypage` | ユーザー情報 / プロジェクト / パートナー管理 / 招待送信 | 🟢 | A | ～ | マイページ#1（うまくいきません→H0-1/H0-4 済） | Phase 2 後半: ホーム/設定への機能分散を検討 |
| 設定 | `/(app)/settings` | 通知設定 / プロフィール編集 / ログアウト | 🟢 | A | ～ | なし | R4: 通知頻度モード（おまかせ/控えめ/オフ） |
| デモモード | `/demo/*` (4 画面) | 未認証体験 / ダミー式場・評価・比較・コーチチャット | 🟢 | A | ✓ | なし | Phase 3: UI 統一 / マーケ用スクショ |

**凡例**:
- 安定度: 🟢 本番稼働（Phase 0 後）/ 🟡 動作するが UX/IA 要改善 / 🔴 未完成または壊れている
- 完成度: S=仕様完全実装 / A=主要機能充足 / B=MVP / C=プレースホルダー
- テスト: ✓ = Unit or E2E あり / ～ = 一部カバー / ✗ = 未カバー

---

## 3. バックエンド機能（Server Actions / ドメイン別）

| ドメイン | ファイル | 主機能 | 安定度 | 完成度 | 既知課題 | 次の進化 |
|---|---|---|---|---|---|---|
| 式場管理 | `venues.ts` | 一覧（フィルタ・ソート）/ 詳細 / URL 解析（Claude） / フィルタクエリ | 🟢 | A | H0-3 orderBy 防御済 | Phase 1: getVenue 分割（P1-4 済） |
| 見積もり | `estimates.ts`, `url-metadata.ts` | 追加・編集 / カテゴリ管理 / PDF 抽出 | 🟡 | A | R1 範囲で統計ベース | R2: Claude PDF 解析精緻化 |
| 評価（☆） | `ratings.ts`, `rating-comparison.ts` | 6次元 auto-save / 訪問評価 / ペアリング比較 | 🟢 | A | H0-5 Visit create 同期済 | Phase 2: 0.5 刻み / 訪問評価 auto-save |
| お気に入り | `favorites.ts` | 自分/相手/共通 3ビュー / 楽観更新 | 🟢 | A | P1-6 で revalidateTag 化済 | Phase 2: 候補比較の写真横並び（W-4） |
| 比較・インサイト | `comparison.ts`, `insights.ts`, `checklist-comparison.ts`, `matrix.ts` | QuickLook / DimensionBar / AIインサイトカード | 🟢 | A | 重複表示あり（#14） | Phase 2: W-5（外部ソース混合）/ W-6（ポジネガ比） |
| オンボーディング | `onboarding.ts`, `onboarding-check.ts`, `onboarding-types.ts` | 条件保存 / AI 推薦 / 初回フロー判定 | 🟡 | B | H0-2 済 / R1 はテンプレ | R2: Claude 推薦 |
| コーチ | `coach.ts` + `/api/coach/stream` | インサイト生成 / チャット（SSE） / メッセージ保存 | 🟡 | B | セッション管理なし | Phase 2: セッション履歴テーブル / R2: Claude 自由対話 |
| パートナー | `invitations.ts`, `partner-reactions.ts` | 招待リンク / 受諾 / ゲストリアクション | 🟢 | A | H0-4 acceptedAt 済 | R3: Realtime / Level 2-3 |
| 訪問記録 | `visits.ts` | スケジュール / チェックリスト / メモ・写真 / 評価 | 🟢 | B | UI は R3 で拡充予定 | R3: AI 生成チェックリスト / GPS 自動付与 |
| 最終決定 | `decisions.ts` | Decision Ceremony / confetti / 理由記録 | 🟢 | A | なし | Phase 3: OGP 画像生成 |
| 口コミ・分析 | `reviews.ts`, `review-schema.ts` | 外部口コミ取得 / AI 要約 / センチメント | 🟡 | B | 探す#15（AI失敗→H0-2済）/ 要約ボタン UX | R2: Claude 要約 / W-6 比率バー |
| プラン | `plans.ts`, `plan-schema.ts` | 式場プラン / 持ち込み料金 | 🟡 | A | W-2 料金表 UI | Phase 2: 行テーブル化 |
| ホーム集約 | `home.ts` | getHomeData / getCurrentUserName / AIインサイト集約 | 🟢 | A | Phase 1 で軽量版分割済（P1-3） | Phase 2: NBA 統合 |
| 認証・ユーザー | `auth.ts`, `user-data.ts`, `profile.ts` | ログイン / プロジェクト所属 / クロスプロジェクト防止 | 🟢 | A | P1-2 React.cache 済 | 継続保守 |
| プロジェクト | `projects.ts` | getOrCreateProject / bottomNavBadgeCounts | 🟢 | A | なし | P1-6 revalidateTag |

**合計**: Server Action 30 ファイル、約 4,700 LOC。最大は `venues.ts`（約 630L、P1-4 で分割）。

---

## 4. データモデル（Prisma）

| エンティティ | 用途 | 注意点 |
|---|---|---|
| `User` | 認証ユーザー | Supabase Auth と連動。Email + Google OAuth |
| `Project` | カップル単位のプロジェクト | `conditions` (JSON) に AI 推薦入力。`currentStep` は廃止予定（Phase 2） |
| `ProjectMember` | プロジェクト参加者（owner/partner） | `acceptedAt` null = 招待待ち。owner は自動 `new Date()`（H0-4） |
| `Venue` | 式場基本情報 | `paymentMethodEnums`（新）vs legacy `paymentMethods`。R1.5c 過渡期 |
| `VenueScore` | 多次元評価スコア | `UNIQUE(venueId, dimension, source)`。W-5 で複数ソース混合計画 |
| `Estimate` | 見積もり（バージョン管理） | `predictedFinal` は R2 Claude PDF 解析で精緻化 |
| `EstimateItem` | 見積もり明細 | `category`（8種）/ `tier`（minimum〜premium）/ `upgradeProbability` |
| `Visit` | 見学記録 | R3 で UI 拡充。モデルは完成 |
| `VisitChecklistItem` | 見学チェックリスト | 写真添付可能。R3 で AI 生成化 |
| `VisitNote` | 見学メモ・写真 | GPS 座標オプション |
| `VisitRating` | 訪問時評価 | 見学後の印象。R3 Realtime 同期 |
| `VenueFavorite` | お気に入り（ユーザー単位） | 「候補」UI の実体。多対多 |
| `VenuePlan` | 式場プラン | `bringInItems` (JSON)。W-2 料金表 UI |
| `Review` | 外部口コミ | `aiSummary` / `sentiment` / `isNegative`。R2 Claude 解析 |
| `AiAnalysis` | AI 分析結果キャッシュ | `inputHash` で重複排除。R2 で `coach_chat` 活用 |
| `Decision` | 最終決定 | 1 project = 1 decision（unique） |
| `CoachMessage` | AIコーチ履歴 | R2 で実装本格化 |
| `PartnerReaction` | ゲストリアクション | Level 1（visitorToken）→ R3 Level 2-3 |
| `NotificationPreference` | 通知設定 | R4 で実使用 |

最新マイグレ: `20260414100000_payment_method_enum`（本番適用済 — Phase 0 H0-1）

---

## 5. 横断的機能

| 項目 | 実装状況 | 既知課題 | 方針 |
|---|---|---|---|
| 認証 | Supabase Email + Google OAuth（計画） | H0-4 済 | 継続保守 |
| 画像 | Supabase Storage + next/image | Phase 11 で `priority`/`sizes` 整備 | P1-7 で `remotePatterns` を Supabase 限定済 |
| AI 統合 | Claude API（R1: URL 解析のみ） | API Key 設定は Phase 0 H0-2 で解決 | R2: Vercel AI Gateway 経由へ統一 |
| フォーム | react-hook-form + zod | なし | 継続 |
| UI ライブラリ | shadcn/ui v2（44px 上書き済） | デフォルトサイズ 32px 罠は対処済 | Phase 3 で visual v3 適用 |
| アニメーション | framer-motion + CSS transition | バンドル肥大 | P1-7 で optimizePackageImports、Phase 11 で bottom-nav CSS 化済 |
| キャッシュ | React.cache（P1-2）+ `"use cache"`（P1-6）+ revalidateTag | なし（Phase 1 導入完了） | Phase 1 後の負荷計測で調整 |
| 計測 | PostHog + Sentry + SpeedInsights | 本番ダッシュボード整備途中 | Phase 4 で Core Web Vitals 比較 |
| エラー処理 | `error.tsx` + `global-error.tsx` + Sentry | なし | Phase 0 で完備 |
| 通知 | モデル定義のみ | UI 未実装 | R4 で頻度モード実装 |
| ダークモード | CSS 変数準備（未切替） | なし | R4 で切替 UI 実装 |
| i18n | next-intl scaffold（ja のみ運用） | EN 翻訳未 | 将来の海外展開時 |
| SEO | metadata / robots / sitemap / manifest / OGP 画像 | Phase 0 で整備済 | Phase 3 で OGP デザイン刷新 |
| ルーティング | Next.js 16 App Router + cacheComponents + viewTransition | `/dashboard`→`/home` 等 redirects 設定済 | Phase 1 で PPR 有効化 |

---

## 6. 既知課題・バグサマリ

### Phase 0 — 緊急ホットフィックス（2026-04-14 完了）

| # | 項目 | 状態 | 対応ファイル |
|---|---|---|---|
| H0-1 | 本番 DB マイグレ適用 | ✓ | Vercel Build Command + `prisma migrate deploy` |
| H0-2 | Anthropic API Key / Gateway | ✓ | `src/lib/claude.ts`, Vercel env |
| H0-3 | `getVenues` orderBy 防御 | ✓ | `src/server/actions/venues.ts` |
| H0-4 | `requireProjectMembership` owner ループ | ✓ | `src/server/auth.ts`, `src/app/(app)/mypage/page.tsx` |
| H0-5 | `saveDirectRatings` Visit create 同期 | ✓ | `src/server/actions/ratings.ts` |
| H0-6 | URL追加モーダル UX（toast, 残留） | ✓ | `src/components/explore/add-venue-sheet.tsx` |
| H0-7 | 「気になる点を先に」ラベル | ✓ | `src/components/venues/review-section.tsx` |

### Phase 1 — 体感速度の底上げ（進行中、2026-04-14）

| # | 施策 | 状態 | 期待効果 |
|---|---|---|---|
| P1-1 | layout 直列await → 並列 + Suspense | ✓ merged | -150〜300ms |
| P1-2 | requireUser / requireProjectMembership を React.cache 化 | ✓ merged | -100〜250ms |
| P1-3 | /home 並列化 / /candidates 軽量化（getCurrentUserName 抽出） | ✓ merged | -300〜500ms |
| P1-4 | getVenue 分割 + Suspense streaming | ✓ merged | LCP -400〜800ms |
| P1-5 | bottom-nav motion.div → CSS + 全タブ prefetch | ✓（Phase 11 で既済） | -200〜500ms |
| P1-6 | `"use cache"` + cacheTag + PPR + View Transitions | ✓ merged | -300〜800ms（再訪問） |
| P1-7 | optimizePackageImports + フォント絞り + 画像最適化 | ✓ merged | JS -100〜300KB |

**Phase 1 完了判定**（未達）:
- モバイル実機（Moto G Power / iPhone 12 相当）でタブ切替 < 500ms
- 初回 /home LCP < 1.8s
- ホーム→候補の"空白"が体感で消える

→ develop にマージ済、本番デプロイ後に計測予定。

### Phase 2 待ちの UX 課題（`ui-ux-remediation-plan.md` 参照）

| 領域 | 課題 | 対応 |
|---|---|---|
| ホーム | NBA カード重複（次の一歩と比較CTA） | Phase 2: 1 CTA に統合 |
| ホーム | 「すべて」→ 探す / 候補 の責務分離 | Phase 2: /candidates に遷移 |
| 探す | 追加ボタン地味 | Phase 2: FAB 昇格 |
| 探す | URL/手動タブ構造 | Phase 2: 段階 BottomSheet（Step1 選択 → Step2 入力 → Step3 確認） |
| 式場詳細 | 縦ボタン羅列 | Phase 2: セグメント化（概要/見積/訪問/口コミ） |
| 式場詳細 | 見積項目名の自由入力なし | Phase 2: プリセット + Combobox |
| コーチ | チャット履歴常時残留 | Phase 2: セッション履歴サイドバー（ChatGPT/Claude準拠） |
| 用語 | 比較する/比べる の揺れ | Phase 4: 「比較する」統一 |

### 妻要望ギャップ（`remediation-master-plan.md §Appendix B-2`、Phase 2 で実装）

| # | ギャップ | 難易度 |
|---|---|---|
| W-1 | カテゴリ別☆ソート追加 | S |
| W-2 | 持ち込み品目料金表 UI | S |
| W-3 | ウォーターフォール信頼区間（±σ） | M |
| W-4 | 候補比較の写真サムネ横並び | M |
| W-5 | 総合☆ の複数ソース加重平均 | M |
| W-6 | ポジ/ネガ比率バー | S |

---

## 7. ロードマップ整合

### v2 4タブ構成

| タブ | 状態 | R1 範囲 | R2+ 範囲 |
|---|---|---|---|
| ホーム | 🟡 Phase 2 待ち | NBA・進捗・最近見た式場 | bento レイアウト、AIパーソナライズ |
| 探す | 🟡 Phase 2 待ち | ブラウズ+追加+フィルタ | FAB / BottomSheet / タブ化 |
| 候補 | 🟢 | VenueFavorite 比較 | Phase 2: W-4 写真横並び |
| コーチ | 🟡 R2 待ち | 定型FAQ + ストリーミングSSE | Claude 自由対話 + セッション履歴 |

### Release 1 AI 境界（`docs/roadmap.md` より）

| 機能 | R1 | R2+ |
|---|---|---|
| オンボーディングAI | 条件保存 + テンプレ推薦 | Claude 推薦 |
| コーチチャット | 定型 FAQ 5-10 + SSE（Claude API コール） | Claude 自由対話 |
| インサイトカード | ルールベース + テンプレ文 | Claude パーソナライズ |
| 見積もり X線 | 統計的 upgrade rate | Claude PDF 精緻化 |
| 比較分析 | テンプレート文 | Claude 自然言語 |
| URL 式場追加 | **Claude API**（唯一の R1 AI）| — |
| 口コミ分析 | 未実装（非表示） | Claude 要約・センチメント |

### 非機能要件（`docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md`）

| 項目 | 予算 | 現状（Phase 1 前） | Phase 1 後 見込み |
|---|---|---|---|
| LCP（モバイル） | ≤ 1.8s | ~2.2s | -400〜800ms |
| TTI | ≤ 3.0s | ~3.5s | 2.5-2.8s |
| CLS | ≤ 0.1 | ~0.08 | 維持 |
| タッチ応答 | ≤ 150ms | 200-500ms | -50〜150ms |
| JS bundle（gzip） | ≤ 200KB | ~220KB | -30〜100KB |

---

## 8. 付録

### 8-1. 用語対応表

| UI 上の表記 | コード/DB | 注意 |
|---|---|---|
| 候補 | `VenueFavorite` | 旧「ショートリスト」は使わない |
| AIコーチ | Coach 画面 / `sendCoachMessage` | UI は「AIコーチ」統一。マーケでは「AIコンシェルジュ」可 |
| 比較する | `comparison.ts`, ComparisonBoard | Phase 4 で「比較する」統一予定（現状「比べる」と揺れ） |
| 探す | `/explore` | 追加 + ブラウズ両方。「集める」は廃止予定（Phase 2） |

### 8-2. 主要コマンド

```bash
npm run dev                         # 開発
npm test                            # Vitest
npm run test:e2e                    # Playwright
npm run lint && npx tsc --noEmit    # 静的解析
npm run build                       # 本番ビルド
npx prisma migrate dev --name <n>   # マイグレーション作成
npx prisma studio                   # DB GUI
```

Ship Cycle（`CLAUDE.md §Ship Cycle`）:
1. E2E（`npx playwright test --project="Mobile Chrome"`）
2. develop merge
3. `git push origin develop`
4. `vercel:deploy prod`（スキル経由必須）
5. worktree 掃除（`git worktree remove` + branch 削除）

### 8-3. 参考ドキュメント

| ドキュメント | 内容 |
|---|---|
| `CLAUDE.md` | プロジェクト Single Source of Truth |
| `DESIGN.md` | デザインシステム v3 "Morning Light" |
| `docs/roadmap.md` | Release 1-4 統合ロードマップ |
| `docs/myreview/remediation-master-plan.md` | Phase 0-4 実ユーザー改善計画 |
| `docs/myreview/problems_01.md` | 妻フィードバック原文 |
| `docs/myreview/ui-ux-remediation-plan.md` | Phase 2-3 IA・ビジュアル詳細 |
| `docs/superpowers/specs/2026-04-13-venuelens-v2-redesign.md` | 全画面 UI 仕様 |
| `docs/superpowers/specs/2026-04-13-release1-technical-spec.md` | R1 技術設計 |
| `docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md` | 非機能要件 |
| `docs/lessons.md` | 開発中の教訓（ルール化前） |

### 8-4. 更新履歴

- 2026-04-14: 初版作成（Phase 0 完了 + Phase 1 merge 直後）
- 次回更新予定: Phase 1 本番デプロイ後の計測結果追記
