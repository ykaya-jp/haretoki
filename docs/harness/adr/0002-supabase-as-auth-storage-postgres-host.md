# 0002. Supabase を Auth / Storage / Postgres ホストとして採用する

- **Status**: Accepted
- **Date**: 2026-04-13 (initial scaffold) / 2026-05-02 (retroactively recorded)
- **Deciders**: yusuke.kaya

## Context

Haretoki は次が必要だった:

- **Email + Google OAuth 認証**: カップル単位 (owner + partner) でプロジェクトを共有する、招待リンクで partner が参加する
- **Postgres**: Prisma で扱える、RLS が使える、composite index / array column / soft delete が無理なく書ける
- **オブジェクトストレージ**: 式場写真、見積もり PDF、OGP 画像。Next.js Image コンポーネントで最適化配信したい
- **realtime broadcast**: パートナーの操作 (お気に入り追加 / 評価 / 見学記録) を相手に即時反映したい (実装は Phase 1.5 後半 `b6226e6` "partner Lv3 — broadcast")
- **ローカル開発 + Vercel preview + 本番** の 3 環境運用が低摩擦であること
- **1 人 + AI agent 開発**: 自前運用 (RDS + Cognito + S3 + ...) を組む工数が許容できない

選択肢: Supabase / Firebase / Neon + Clerk + S3 / Vercel Postgres + NextAuth + Vercel Blob / 自前 RDS 運用。

## Decision

**Supabase を Auth (Email + Google OAuth) / Storage / Postgres の三役で採用する**。具体的には:

- DB は Supabase が hosting する Postgres を Prisma 経由で読み書き (`src/server/db.ts` で PrismaPg singleton)
- 認証は `@supabase/ssr` + `@supabase/supabase-js`。session cookie ベース、middleware で `supabase.auth.getUser()` (公開 path は skip、`247e904`)
- Storage は Supabase Storage バケット (`venue-photos` 等)。バケット自動作成 (`99ef7a2`)、admin client で RLS バイパスして upload (`7c95884`)
- realtime は Supabase Realtime broadcast channel で partner 同期 (`b6226e6`)
- RLS は **補助的な安全装置**。一次防衛は Server Action 内の auth check (`src/server/auth.ts` 統一)。クライアントから直接 Supabase を叩かない方針

## Consequences

良かった点:

- **Auth + DB + Storage + Realtime が 1 つのダッシュボード / 1 つの URL** で揃う。preview / prod の env 切り替えが `.env.local` の差分だけで済む
- **Postgres 標準の機能がそのまま使える**: composite index、array column、JSON 型、ENUM、partial index、soft delete (`deletedAt` パターン、`35370ff`)
- **Prisma との相性が良い**: `directUrl` (migrate 用) と `url` (pgBouncer 経由) を分けて Vercel serverless でも connection 枯渇しない構成が取れる (`1d14d74`)
- **Realtime broadcast** が SDK 1 行で出せたため、partner 同期の実装が軽く済んだ

悪かった点 / 後始末:

- **Storage RLS が落とし穴**: バケット未作成 / RLS で書き込めない / signed URL 期限切れで写真が消える等、初期にトラブル多発 (`99ef7a2` バケット自動作成、`7c95884` admin client bypass、`64cb6cb` source URL fallback、`023084d` next/image 任意 HTTPS source 許可)
- **middleware で `getUser()` を全 path で呼ぶと公開ページが遅くなる**: 公開 path は skip するパッチが必要 (`247e904`)
- **next 16 で cookie API が変化**しており、Supabase ssr ヘルパーの cookie 読み書きも追従が必要だった (`ec3fa3c`)
- **RLS だけに頼ると Server Action で防がれていない経路で漏れる**ため、auth check は必ず Server Action 入口で行う前提が必要 (CLAUDE.md にルール化済)
- **無料枠の DB 接続数 / Storage 容量 / 帯域** が将来ボトルネック化する可能性。商用化時に Pro plan へ昇格判断が要る

## Alternatives considered

- **Firebase**: Auth と Realtime DB は強いが、Postgres + Prisma の組み合わせが取れない。SQL で書きたい (式場の比較・集計クエリ重) ので NoSQL は不向き
- **Neon Postgres + Clerk + AWS S3**: Best-of-breed。ただし 3 ベンダー管理 / 3 ダッシュボード / 3 課金で 1 人運用には重い。preview 環境 setup の摩擦が大きい
- **Vercel Postgres (現 Marketplace 移行) + NextAuth + Vercel Blob**: Vercel に寄せるのは魅力だが、NextAuth のカップル招待・partner ロール対応は自前実装が増える。Supabase の magic link / OAuth callback の方が実装量が少なかった
- **自前 RDS + Cognito + S3**: 工数とコストが許容外

「Auth + DB + Storage + Realtime を 1 ベンダーで賄えて、Prisma + Postgres の表現力を犠牲にしない」 のは Supabase だけだったため採用。

## References

- 初期セットアップ: `16f39de` (deps 追加) / `1d14d74` (Prisma + .env.local)
- middleware perf: `247e904`
- Storage 関連 fix: `99ef7a2` / `7c95884` / `64cb6cb` / `023084d`
- Realtime broadcast: `b6226e6`
- 関連 ADR: [0003 Prisma 7 + PrismaPg adapter](./0003-prisma-7-with-prismapg-adapter.md)
