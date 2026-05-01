# 0001. Next.js 16 App Router を採用する

- **Status**: Accepted
- **Date**: 2026-04-13 (initial scaffold) / 2026-05-02 (retroactively recorded)
- **Deciders**: yusuke.kaya

## Context

Haretoki は結婚式場の比較・評価・最終決定を支援するモバイルファースト (375px) Web アプリ。次の制約があった:

- **モバイル初回表示の速さが UX の核**: 「式場選びを見えやすくする」というプロダクト主張上、初回ロードが重いと信頼を失う
- **データの大半はサーバー側**: 式場 / 見積もり / 見学記録 / AI 出力など、クライアントで保持する状態は少ない
- **Supabase (Postgres + Auth + Storage) を採用予定**: サーバー側で session / RLS を扱う前提
- **AI ストリーミング (Anthropic SDK) を画面に出す**: SSE / Server-Sent streaming に素直に乗れる必要がある
- **OGP / SEO**: 式場詳細・比較ボード・コーチ画面の OGP 動的生成が後で必要 (実際 Phase 2.C で実装、`bf8ff59`)
- **1 人開発 + AI agent**: フレームワーク自体の規約が強いほど AI が読みやすい / 書きやすい

選択肢として検討したのは Next.js (Pages Router / App Router) / Remix / SvelteKit / 自前 Vite + Hono の 4 系統。

## Decision

**Next.js 16 を App Router で採用する**。具体的には:

- `src/app/` 配下を一次ルーティング
- Server Components をデフォルト、`"use client"` は state / effect / event handler が必要なときだけ付ける
- データ取得は Server Action / Route Handler 経由 (クライアントから直接 Supabase を叩かない、RLS は補助的な安全装置)
- `next.config.ts` で `cacheComponents: true` を有効化し PPR / use cache に乗せる
- Vercel に deploy (Fluid Compute、Node.js 24 LTS デフォルト)

Phase 1 立ち上げ時 (`16f39de` 2026-04-13) は Next.js 15 でスキャフォールド済。Phase 1 後半 (W15 移行) で Next.js 16 にアップグレード (`ec3fa3c` "next16 cookie lessons" / `e5e5d26` middleware runtime 修正 / `1f21fe0` cacheComponents 互換性修正) し、以降 16.x 系で運用。

## Consequences

良かった点:

- **Server Components で fetch を component に直書き**できるため、 page → loader → component の 3 段ボイラープレートがない。AI agent が読みやすい
- **Server Action** で form submit → DB write → revalidate を 1 ファイルで書ける。`src/server/actions/*.ts` に集約され Prisma の型がそのまま流れる
- **`cacheComponents` + tag-based revalidation** で、式場詳細など読み取り heavy な画面を tag invalidation だけで cache 制御できる (`e75fa60` 等)
- **Vercel Fluid Compute** で middleware が full Node.js 動作。Edge runtime 縛りで詰まる API がない

悪かった点 / 後始末:

- **Next 15 → 16 アップグレードで cookie API / middleware runtime / cacheComponents の挙動が破壊的に変わった**。実機で初めて壊れる失敗が複数 (`docs/lessons.md` 2026-04-30 動的スモーク必須ルール / `lessons` "next16 cookie lessons")
- **`"use client"` を不要に付けた箇所が prod だけで死ぬ**事故 (`22ed96d` "drop \"use client\" from SettingsRow to unblock /mypage SSR")。CSS-only animation のために client 化しない、というルールを `lessons.md` 2026-04-30 に追加
- **`cacheComponents: true` 環境では `dynamic` / `runtime` 設定が必要な場面が変化** (`1f21fe0`)。ICS export 等の動的レスポンスはルートごとに調整が必要
- **App Router 用の test fixtures は世の中にまだ少ない**。Playwright spec で `cookies()` / `headers()` を扱うときの mock パターンは自前で揃えた

## Alternatives considered

- **Next.js Pages Router**: 安定しているが Server Components が使えず、AI streaming / RSC の利点を捨てることになる。AI agent が触る前提だと App Router の方が「規約の中で動く」感覚が強く、誤実装が減る
- **Remix**: loader / action モデルは綺麗だが、当時 Remix v2 → React Router への移行期で破壊的変更が見えていた (2026-04 時点)。学習コストの再請求が嫌だった
- **SvelteKit**: ランタイムは速い。ただし shadcn/ui エコシステム (採用予定) と AI agent の Next.js 学習量が圧倒的に多く、AI が "迷わない" メリットを重視
- **Vite + Hono 自前構成**: 柔軟性は最大、ただし routing / cache / streaming / OGP / middleware 全部自分で組む。1 人 + AI agent では摩擦が高すぎる

「AI agent が読みやすい・書きやすい・規約の外に出にくい」を最重要評価軸とし、Next.js 16 App Router を採用。

## References

- Initial scaffold: `16f39de` "scaffold Next.js 15 project"
- Upgrade hardening: `ec3fa3c` / `e5e5d26` / `1f21fe0` / `2c08b0f` / `13ea03b`
- 関連 lesson: `docs/lessons.md` 2026-04-30 動的スモーク必須ルール
