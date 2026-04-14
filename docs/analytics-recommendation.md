# Haretoki 計測基盤 調査 & 推奨

調査日: 2026-04-14 / 対象ブランチ: `develop`

## 1. 現状 (事実ベース)

**インストール済みの計測系パッケージ: ゼロ**

`package.json` を精査した結果、以下のいずれも未導入:

- `@vercel/analytics` / `@vercel/speed-insights`
- `posthog-js` / `posthog-node`
- `@sentry/nextjs`
- `mixpanel-browser` / `amplitude-js` / `plausible-tracker` / `umami`
- Google Analytics (`gtag`, GA4 スクリプト) も `layout.tsx` に無し

関連ファイルの状態:

- `src/app/layout.tsx` — `<Analytics />` / `<SpeedInsights />` マウントなし
- `next.config.ts` — redirects のみ。計測関連の設定なし
- `instrumentation.ts` / `instrumentation-client.ts` — **ファイル自体存在せず** (Sentry や OTel の hook 点なし)
- `vercel.json` — **存在せず** (Vercel 側はデフォルト挙動)
- `.env.example` / `.env.local` — Supabase + Anthropic のみ。`POSTHOG_KEY` / `SENTRY_DSN` / `GA_ID` などは未定義
- `/api/track` のような自前エンドポイントも無し

**本番 env vars**: `vercel env ls production` は今回のサンドボックスでは実行不可だったため未確認。`.env.example` が「計測系の占有キーを持っていない」事実から、Vercel 側にも関連キーは設定されていない可能性が高い (要 `vercel env ls production` で最終確認)。

**現時点で取れているシグナル**:

- Vercel ダッシュボードのビルド/デプロイログ、Function invocation count
- Supabase の DB クエリログ (Supabase ダッシュボード)
- **プロダクト行動は何も計測されていない**。サインアップ率・式場追加率・リテンションは今は誰も答えられない状態

## 2. オプション比較 (Haretoki 文脈)

| ツール | 何が取れる | 工数 | 現時点コスト | 成長時コスト | 備考 |
|---|---|---|---|---|---|
| **Vercel Web Analytics** | ページビュー / 参照元 / デバイス。ファネル/リテンション ×. PII 無し (Cookie-less) | 15分 (npm i + `<Analytics />` 貼り付け) | Hobby: 2.5k events/月で頭打ち / Pro: $20/月に含 | イベント数課金: 100k events $14 | Cookie同意バナー不要. Next.js と統合最良 |
| **Vercel Speed Insights** | Core Web Vitals RUM (LCP/INP/CLS) | 10分 | Hobby無料枠あり / Pro込 | 使用量課金 | パフォーマンス専用. Analyticsと補完関係 |
| **PostHog Cloud** | ページビュー + **ファネル + リテンション + セッションリプレイ + フィーチャーフラグ + A/B + ダッシュボード** | 1-2h (Provider 追加, `identify`, `capture` 埋め込み) | **1M events/月無料** | 1M超: $0.0000368/event ≒ 約¥5/1k events | プロダクト分析の本命. EU/JP リージョン選択可. セルフホストも可 |
| **Plausible / Umami** | PV/参照/デバイスのみ. 軽量 | 20分 | Umami self-host無料 / Plausible $9/月〜 | 線形 | ファネル/イベント属性は弱い. Cookie同意不要 |
| **Google Analytics 4** | PV/イベント/オーディエンス. 強力だが学習曲線急 | 30分 + Cookie同意バナー実装 (+3-5h) | 無料 | 無料 | **日本でも Cookie 同意取得が実質必須** (改正電気通信事業法外部送信規律). Haretoki は外部送信先表示義務あり |
| **Sentry** | エラー・例外・ソースマップ対応スタックトレース. Performance も可 | 1h (`@sentry/nextjs` + wizard) | **5k errors/月無料** | Team $26/月 (50k errors) | プロダクト分析ではなく可観測性軸. Analytics と併用が基本 |
| **Supabase 自前 events テーブル** | 好きに設計可 | 4-8h (テーブル + Server Action + ダッシュボードクエリ) | ほぼゼロ (既存DB) | Supabase 行数次第 | ダッシュボード/ファネルは自作必要. ROIが合わない |

## 3. 推奨

### Phase 1 — 今すぐ (所要 約2時間)

**PostHog Cloud (EU リージョン) + Vercel Speed Insights の2本立て**

- PostHog: プロダクトファネル・リテンション・セッションリプレイまで1つで済む。無料枠 1M events/月は現在の規模 (2-3ユーザー) では1000年分以上。**Haretoki が計測したい 6 指標 (サインアップ率 / オンボ完了率 / D0 式場追加率 / 7日リテンション / インサイトカード CTR / パートナー招待承諾率) は全てファネル + コホート機能で標準的に取れる**
- Speed Insights: モバイルファースト (375px) を掲げる以上、INP/LCP の実測値をプロダクト側で追うべき。追加工数 10 分、Vercel Pro なら追加課金なし
- **Sentry は Phase 1 では入れない**。決定前の alpha なのでエラー収集よりプロダクト指標が先

### Phase 2 — 育ったら (MAU ≥ 200 または有料化判断時)

- **Sentry** を追加 (商用化で SLA を出すなら必須)
- **PostHog のフィーチャーフラグ** を有効化して A/B (例: オンボ質問数 3 vs 4)
- MAU が 10k 超 or イベント 1M/月 超で初めて PostHog 有料プラン ($0/月 → 従量) を検討。それでも月 ¥数千円レベル

### 不採用の根拠

- **GA4**: 改正電気通信事業法の外部送信規律で同意バナー実装コスト発生. B2C 日本ユーザー相手だと UX を損ねる
- **Plausible/Umami**: PV しか取れず、ファネル分析ができない. Haretoki の本丸である「どこで離脱するか」が見えない
- **Vercel Web Analytics 単体**: ファネル不可. 入れるなら PostHog と重複するので不要
- **自前テーブル**: ダッシュボード自作の人件費で PostHog 5年分を超える

## 4. 計測すべきイベント (実装時の仕様案)

| イベント名 | 発火場所 | プロパティ |
|---|---|---|
| `signup_completed` | Supabase Auth callback 後 (`/auth/callback`) | `method: email\|google`, `project_id` |
| `onboarding_completed` | オンボ最終ステップの Server Action | `questions_answered`, `duration_sec` |
| `venue_added` | `addVenue` Server Action 成功時 | `source: search\|url\|manual`, `is_first_venue: bool`, `day_since_signup: number` |
| `venue_favorited` | ハートボタン (`heart-button.tsx`) | `venue_id`, `from_tab: home\|explore\|candidates` |
| `insight_card_clicked` | `insight-card.tsx` の CTA | `insight_type`, `position` |
| `partner_invited` | 招待送信 Server Action | `method: link\|email` |
| `partner_invite_accepted` | 受諾ランディング | `hours_since_invite` |
| `estimate_uploaded` | 見積もり登録 Server Action | `has_pdf: bool`, `total_yen_bucket` |
| `decision_made` | `decision-ceremony.tsx` 確定時 | `venues_compared_count`, `days_since_signup` |
| `coach_message_sent` | `sendCoachMessage` | `message_length_bucket`, `turn_index` |

`identify(userId, { project_id, role: owner|partner, created_at })` を認証後に 1 回呼ぶ → 全イベントがユーザー単位で紐づく。

## 5. 実装方針プレビュー (Phase 1)

```bash
npm i posthog-js @vercel/speed-insights
```

1. `src/components/providers/posthog-provider.tsx` を新設 ("use client")。`posthog.init(NEXT_PUBLIC_POSTHOG_KEY, { api_host: 'https://eu.i.posthog.com', capture_pageview: 'history_change', person_profiles: 'identified_only' })`
2. `src/app/layout.tsx` の `<ThemeProvider>` 直下に `<PostHogProvider>` + `<SpeedInsights />` を配置
3. `src/lib/analytics.ts` に `track(event, props)` / `identify(userId, traits)` の薄いラッパを作り、Server Actions から呼ぶ箇所は `posthog-node` を server 側で使うか、クライアントから `useEffect` でキックする (MVPは後者で可)
4. `.env.example` と Vercel env (preview + production) に `NEXT_PUBLIC_POSTHOG_KEY` を追加
5. **検証**: preview デプロイで自分が操作 → PostHog Live events に 10 秒以内で出現することを確認. Speed Insights は Vercel ダッシュボード > Speed Insights タブで 24h 以内にデータが溜まる
6. `person_profiles: 'identified_only'` で匿名訪問者のプロファイル生成を抑制 → 無料枠を節約

プライバシー表記 (プライバシーポリシー末尾) に「PostHog (EU) を利用してプロダクト改善のための行動データを収集」の1行を追加すれば改正電気通信事業法の外部送信規律も充足する。

## 6. Vercel CLI

ローカル環境の `vercel` CLI が **50.44.0** で、最新は **51.2.0**。以下を推奨:

```bash
npm i -g vercel@latest
vercel --version   # => 51.2.0 を確認
```

アップグレード後に `vercel env ls production` を再実行して POSTHOG_KEY 等の事前登録を最終確認する。
