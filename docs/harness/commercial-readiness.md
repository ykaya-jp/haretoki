# Commercial Readiness Checklist

公開 (一般ユーザー登録開始 / 課金開始 / プレスリリース打ち) 前に **must-have** と
**should-have** を可視化する台帳。実装ロードマップ (`docs/PENDING.md`) は
「機能の積み残し」管理、本ドキュメントは「商用化要件として通っているか」管理。

各項目は `✅ 済 / 🟡 部分対応 / ❌ 未着手 / ⏳ launch 直前` の 4 段階。
status 横の `<commit/file>` で根拠を即引ける形を維持する (drift しないように)。

最終更新: 2026-05-02 (P2 round 14 反映 — Resend webhook business logic 強化 + Sentry wire audit)

## 集計サマリ

| 軸 | ✅ 済 | 🟡 部分 | ❌ 未着手 | ⏳ launch 直前 | 合計 |
|---|---|---|---|---|---|
| 1. 法務 / コンプライアンス | 5 | 1 | 2 | 1 | 9 |
| 2. セキュリティ | **8** | **0** | 1 | 0 | 9 |
| 3. 観測性 / 運用 | **8** | 0 | **1** | 0 | 9 |
| 4. スケール | 7 | 0 | 1 | 1 | 9 |
| 5. UX 商用化要件 | 7 | 1 | 1 | 0 | 9 |
| 6. ビジネス / サポート | 1 | 0 | 4 | 2 | 7 |
| **合計** | **36** | **2** | **10** | **4** | **52** |

商用化までの「あと N 件」: **❌ 未着手 10 + ⏳ launch 直前 4 = 14 件** が must-have の残り作業
(うち 🟡 部分対応 2 件は要昇格判断)。

**P2 round 13 で進捗**: ✅ 34 → 36 (+2)、 🟡 3 → 2 (-1)、 ❌ 11 → 10 (-1)。
2.3 Rate limiting を Upstash Redis backend で global 化、 3.8 Anthropic コスト
tracking を `AiCostSnapshot` テーブル + `/admin/cost` dashboard で常設化。

**P2 round 10 で進捗**: ✅ 32 → 34 (+2)、 ❌ 12 → 11 (-1)、 🟡 4 → 3 (-1)。
Resend webhook (3.7) + Vercel BotID (2.8) を `BOT_ID_ENABLED` / `RESEND_WEBHOOK_SECRET`
フィーチャーフラグ可能な形で導入、 ADR-0009 に詳細。

## 1. 法務 / コンプライアンス

| # | 項目 | Status | 根拠 / 残作業 |
|---|---|---|---|
| 1.1 | プライバシーポリシー | ✅ | `src/app/(auth)/privacy/page.tsx` (Claude / PostHog / Sentry / Vercel Analytics 開示済) |
| 1.2 | 利用規約 | ✅ | `src/app/(auth)/terms/page.tsx` |
| 1.3 | データエクスポート (個人情報保護法 27 条 / GDPR Art.20) | ✅ | `src/app/api/user/export/route.ts` |
| 1.4 | データ削除 (同 30 条 / GDPR Art.17) | ✅ | `src/app/api/user/delete/route.ts` |
| 1.5 | 退会フロー (UI 動線) | ✅ | `/mypage` から削除 API 経由で退会、Supabase auth user も同期削除 |
| 1.6 | Cookie / トラッキング同意 (PostHog / Vercel Analytics) | 🟡 | 現状: privacy.md で開示のみ、 opt-in / opt-out UI 不在。日本で必須ではないが、EU からのアクセスで GDPR 適合を求めるなら opt-in banner 要追加 |
| 1.7 | 特商法表記 (もし課金あれば) | ⏳ | 課金導入時に必須。現状無料サービスなので未対応で OK |
| 1.8 | 著作権 / 第三者素材表記 (式場写真の出所など) | ❌ | 現状: 式場サイトから取得した photoUrls をそのまま表示。商用化前に「サイト出典明示 + 削除リクエスト窓口」の整備必須 |
| 1.9 | 18 歳未満利用制限 / 同意 | ❌ | 結婚式場という性質上、未成年単独利用は想定外。利用規約に明記する形で対応 |

## 2. セキュリティ

| # | 項目 | Status | 根拠 / 残作業 |
|---|---|---|---|
| 2.1 | Auth flow (Supabase Email + Google OAuth) | ✅ | `src/app/(auth)/{login,signup}/page.tsx`、email_confirmed_at gate (`invitations.ts:212-222`) |
| 2.2 | RLS / 認可境界 | ✅ | `src/server/auth.ts` 冒頭 docstring に shared / personal / owner-only の 3 軸明記、ADR-0002 |
| 2.3 | Rate limiting (汎用) | ✅ | `src/lib/rate-limit.ts` 汎用 sliding-window 実装、 backend abstraction で in-memory (default) ↔ Upstash Redis (`UPSTASH_REDIS_REST_URL/TOKEN` 設定で global cluster-wide) 切替可能。 hot path (coach.ts / venues.ts / estimates.ts) は `RATE_LIMITS.{COACH_MESSAGE,URL_IMPORT,PDF_ANALYZE}` で配線済 (P2 round 11 + round 13、 `docs/ai/cost-baseline.md`) |
| 2.4 | CRON_SECRET 認証 | ✅ | 全 5 cron route が Bearer 検証 (`docs/harness/cron-monitoring.md`) |
| 2.5 | Secret 漏洩防止 hook | ✅ | `.claude/settings.json` PreToolUse が `.env*` / `.key` / `.pem` / `*credentials*` 書込 block (`docs/harness/hooks.md` §1) |
| 2.6 | Prompt injection 対策 | ✅ | `sanitizeForPrompt()` + `<user_data>` タグで囲む規約、PII strip、`docs/ai/guardrails.md` |
| 2.7 | Account takeover 防止 (email verification) | ✅ | `acceptInvitation` で 3 ルート (email_confirmed_at / user_metadata / identities) のいずれかで verified を要求 |
| 2.8 | Bot 対策 (signup 量産防止 etc.) | ✅ | Vercel BotID + `BotIdClient` を root layout で mount、 `/api/coach/stream` (POST) + `/api/user/delete` (DELETE) + `/api/user/export` (GET) を server-side `detectBot()` で 403。 `BOT_ID_ENABLED=1` で本番 enforcement (P2 round 10、 ADR-0009) |
| 2.9 | Audit log (誰が何を delete したか) | ❌ | Notification table はあるが、 actor + 削除対象の永続記録なし。商用化前に必要なら `AuditLog` table 追加 (additive、ADR-0002 同 pattern) |

## 3. 観測性 / 運用

| # | 項目 | Status | 根拠 / 残作業 |
|---|---|---|---|
| 3.1 | Sentry 統合 (server / client / edge) | ✅ | `sentry.{client,server,edge}.config.ts` + `src/lib/sentry.ts` (DSN 未設定時 no-op、 captureError + captureMessage helper) |
| 3.2 | Sentry capture coverage (hot paths) | ✅ | 6+ server actions (decisions / decision-todos / venues / coach / venue-search / visit-reminder) で配線済 |
| 3.3 | Cron monitoring playbook | ✅ | `docs/harness/cron-monitoring.md` で全 5 cron の初回 / 週次 / 異常パターン整備 |
| 3.4 | 構造化 log (Vercel logs grep 可) | ✅ | `src/lib/observability.ts` の `logEvent` で 11 イベント taxonomy を一本化、 全 cron / webhook / cache / botid が JSON 1 行で出力。 Vercel Log Drain consumers + `vercel logs --json | grep '"event":"<name>"'` で per-day query 可能 (P2 round 12、 `docs/harness/sentry-alerts.md`) |
| 3.5 | PostHog 行動分析 | ✅ | `src/lib/analytics.ts` (client) + `captureServerEvent` (server)、未設定時 no-op |
| 3.6 | Vercel Analytics (Web Vitals) | ✅ | Vercel built-in (deploy 自動有効) |
| 3.7 | Email deliverability tracking (Resend webhook) | ✅ | `/api/webhooks/resend` で Svix HMAC 検証 + Notification.{resendMessageId,emailDeliveryStatus} 永続化。 round 14 拡張: bounce タイプ別に suppression reason (hard/soft/complained/manual) を分類、 user-facing in-app notice + admin notice email を fan-out、 daily `/api/cron/email-suppression-retry` で soft bounce を 7 日後に auto-retry (P2 round 10 + round 14、 ADR-0009) |
| 3.8 | Anthropic API コスト tracking | ✅ | `evaluateBudgetAlert()` で日次 / 月次予算超過時 Sentry alert (`cron.ai-cost` × `error/warning`)。 `AiCostSnapshot` table に毎日 1 行 upsert、 `/admin/cost` dashboard で直近 30 日を可視化 (`ADMIN_EMAILS` allow-list)。 詳細運用は `docs/ai/cost-baseline.md` (P2 round 11 + round 13) |
| 3.9 | Uptime monitor (外形監視) | ❌ | Vercel built-in は内部視点のみ。Better Stack / UptimeRobot 等の外形監視を `/health` endpoint と組み合わせて入れる |

## 4. スケール

| # | 項目 | Status | 根拠 / 残作業 |
|---|---|---|---|
| 4.1 | prisma index 11 composite | ✅ | round 1 (4) + round 7 (3) + W20-3 (4) で hot path ほぼ網羅 |
| 4.2 | N+1 全数解消 | ✅ | round 1 (fit-reason batched + ritual cron) + round 6 sweep (6 sites) |
| 4.3 | AI cache coverage 47%→78% | ✅ | round 6 で 8 cacheable site 全部に cache 配線、 model + promptVersion で hash 化 |
| 4.4 | Bundle size baseline | ✅ | 18MB total / max chunk 437KB / mobile target ≤ 500KB First Load JS 範囲内 (`cron-monitoring.md` §Bundle Size Baseline) |
| 4.5 | バーチャルスクロール (candidates / coach history) | ✅ | round 7 で worker C 実装 |
| 4.6 | DB connection pool sizing (Prisma + Supabase) | ✅ | Prisma 7 + PrismaPg adapter (ADR-0003)、 Supabase pooler 経由 |
| 4.7 | Vercel function timeout (cron 5min, 一般 60s default) | ✅ | 各 cron route で `export const maxDuration = 300`、 一般は default 60s で十分 |
| 4.8 | Background job queueing (Vercel Queues) | ⏳ | 現状 Vercel Cron で daily / hourly はカバー、 user-triggered 重い処理 (PDF 解析等) は同期で OK。 大規模化したら Vercel Queues (2025 public beta) 導入 |
| 4.9 | DB backup / point-in-time recovery 検証 | ❌ | Supabase が daily backup + 7d PITR を提供 (Pro plan 以上)。 現プラン確認 + 月次 restore drill が商用化基準 |

## 5. UX 商用化要件

| # | 項目 | Status | 根拠 / 残作業 |
|---|---|---|---|
| 5.1 | OGP 画像 dynamic | ✅ | round 7 era で worker C 実装、 root + venue + compare + coach の 4 routes |
| 5.2 | sitemap.xml + robots.txt | ✅ | `src/app/sitemap.ts` + `src/app/robots.ts` |
| 5.3 | PWA manifest + offline page | ✅ | `src/app/manifest.ts` + `src/app/offline/page.tsx` (PWA shell + iOS install prompt) |
| 5.4 | a11y WCAG AA | ✅ | round 5 era で worker C 実装、 7 main screens 対応 |
| 5.5 | ダークモード | ✅ | round 4 era で worker C 実装、 7 screens parity、ADR-0004 (color-mix migration) |
| 5.6 | error.tsx / global-error 全 segment | ✅ | W16-7 で 7 segment 補完済 (PENDING.md Phase 1 W16) |
| 5.7 | loading.tsx スケルトン | ✅ | `CLAUDE.md` 規約として配置済 (新ページ追加時の必須項目) |
| 5.8 | i18n / 多言語化 | 🟡 | next-intl 撤去確認済 (P2 round 7)、 日本語のみで launch、 英語化は商用化第 2 段で要否判断 |
| 5.9 | 404 ページ デザイン | ❌ | `_not-found` route はあるが、 brand-aligned デザイン化されていない可能性。 monkey-test で要確認 |

## 6. ビジネス / サポート

| # | 項目 | Status | 根拠 / 残作業 |
|---|---|---|---|
| 6.1 | サポート問い合わせ窓口 | ❌ | 現状なし。 商用化前に email or `/support` ページが必須 |
| 6.2 | FAQ / ヘルプ | ❌ | 現状なし。 launch 時の問い合わせ削減のため must-have |
| 6.3 | 不正利用 / 不適切コンテンツ通報窓口 | ❌ | UGC (式場名 + memo) があるため通報経路が必須 |
| 6.4 | 料金プラン / 課金 (もし有償化があれば) | ⏳ | 現状無料、 課金時は Stripe + 1.7 特商法 + 利用規約改訂 |
| 6.5 | Stripe / 決済 integration (同上) | ⏳ | 同上 |
| 6.6 | 利用ガイド / オンボーディング動線 | ✅ | onboarding 4 質問 → AI 推薦の動線が完成済 (Phase 1 + P2.A round 1/2 で精緻化) |
| 6.7 | 退会後のデータ保持期間ポリシー | ❌ | 現状: `/api/user/delete` は cascade delete だが、 retention period 明示なし。 個人情報保護法上「不要になったら遅滞なく消去」基準 + 利用規約に明示要 |

## 商用化までの最短経路 (推奨優先順位)

❌ 未着手 10 件のうち、 launch ブロッカーになる順 (P2 round 13 で 2.3 + 3.8 が ✅ に昇格 → 残 priority 上位 8 件):

1. **6.1 サポート問い合わせ窓口** + **6.3 通報窓口** — 法的 (景表法 / 特商法問題発覚時の連絡経路) + 運用上 必須 (※ worker C2 round 11 で /support 実装済、 次回 readiness pass で ✅ 昇格判定)
2. **1.8 著作権 / 写真出典表記** — 式場サイトとのトラブル予防
3. **3.9 Uptime monitor** — launch 後の信頼性担保
4. **6.2 FAQ / ヘルプ** — 問い合わせ削減
5. **2.9 Audit log** — トラブル時の調査
6. **4.9 DB backup 検証** — 月次 drill 含めて
7. **6.7 退会後データ保持ポリシー** — 利用規約に明示
8. **5.9 404 ブランドデザイン** — UX polish

🟡 部分対応の昇格判断:
- 1.6 Cookie 同意: EU トラフィック予測次第
- 2.3 Rate limiting: 上記 #2 で本対応
- 3.7 Resend webhook: 上記 #4 で本対応
- 5.8 i18n: 海外展開時のみ

⏳ launch 直前:
- 1.7 特商法 / 6.4 料金 / 6.5 Stripe — 課金時のみ
- 4.8 Vercel Queues — 規模拡大時
- 5.8 i18n も同様

## 関連ドキュメント

- 機能ロードマップ: [`docs/PENDING.md`](../PENDING.md)
- ADR (取り返しのつかない判断): [`docs/harness/adr/`](./adr/)
- Cron 監視: [`docs/harness/cron-monitoring.md`](./cron-monitoring.md)
- Hooks: [`docs/harness/hooks.md`](./hooks.md)
- MCP: [`docs/harness/mcp.md`](./mcp.md)
- Runbook: [`docs/harness/runbook.md`](./runbook.md)
- AI Guardrails: [`docs/ai/guardrails.md`](../ai/guardrails.md)

## 更新ルール

- 新規 `commit` で commercial readiness を変える項目を実装したら、 同 PR で本ファイルの該当行を更新する
- Status 変更 (`❌` → `✅` 等) は単独 commit より、 該当機能 PR の最後に含めて 1 commit にする (drift 防止)
- 新項目を追加する場合: 集計サマリの該当軸 行 と Total 行を必ず更新
