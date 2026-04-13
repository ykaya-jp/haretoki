# Release 2: AI Intelligence — 実装計画

> Claude API 全接続で AI 機能を有効化。R1 のプレースホルダーを実機能に置換。
> 技術設計書: docs/superpowers/specs/2026-04-13-release2-technical-spec.md

---

## Phase A: Foundation (順次)

### A-1: Prisma スキーマ変更
- [ ] Review モデル + ReviewSource enum 追加
- [ ] CoachMessage モデル + MessageRole enum 追加
- [ ] Project にリレーション追加 (coachMessages)
- [ ] Venue にリレーション追加 (reviews)
- [ ] マイグレーション + Prisma Client 再生成

### A-2: anthropic.ts 共通クライアント
- [ ] src/lib/anthropic.ts 新規作成 (askClaude, streamClaude, computeInputHash, stripPII, withRetry)
- [ ] src/lib/claude.ts を後方互換ラッパーに変更
- [ ] 既存の venues.ts (addVenueFromUrl) を新クライアントに移行

### A-3: プロンプト管理
- [ ] src/lib/prompts/ ディレクトリ作成
- [ ] coach-chat.ts (システムプロンプト + コンテキスト構築)
- [ ] estimate-analysis.ts (既存を移動 + 改善)
- [ ] url-extraction.ts (既存を移動)
- [ ] review-summary.ts (口コミ要約)
- [ ] comparison.ts (比較分析)
- [ ] onboarding.ts (推薦)

## Phase B: AI機能実装 (並列可能)

### B-1: コーチチャット Claude API 化
- [ ] CoachMessage テーブルへの保存に切り替え
- [ ] sendCoachMessage を Claude API 呼び出しに変更 (isClaudeAvailable でフォールバック維持)
- [ ] ストリーミング Route Handler (src/app/api/coach/stream/route.ts)
- [ ] ChatBar をストリーミング対応に更新
- [ ] getCoachHistory を CoachMessage テーブルから取得に変更

### B-2: AI 比較分析
- [ ] getComparisonData の insight 生成を Claude API に置換
- [ ] inputHash によるキャッシュ (24h TTL)
- [ ] フォールバック: R1 テンプレート文

### B-3: 口コミ AI 要約
- [ ] Review テーブル活用
- [ ] 口コミソース URL 入力 UI (VenueDetail)
- [ ] Claude API で要約生成 + sentiment 分析
- [ ] VenueDetail に AI 分析カード表示

### B-4: オンボーディング AI 推薦
- [ ] saveOnboardingAnswers 完了後に Claude で式場推薦
- [ ] 推薦結果をオンボーディング完了画面に表示
- [ ] 推薦式場の「追加する」ボタン

## Phase C: 統合 + テスト

- [ ] 全 AI 機能の結合テスト
- [ ] lint + build 確認
- [ ] code-reviewer セルフレビュー
