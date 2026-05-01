# 0003. Prisma 7 + PrismaPg adapter を ORM に採用する

- **Status**: Accepted
- **Date**: 2026-04-13 (initial scaffold) / 2026-05-02 (retroactively recorded)
- **Deciders**: yusuke.kaya

## Context

ADR-0002 で Postgres を Supabase に置く決定をした。アプリ側の DB レイヤーで必要だったのは:

- **モデル定義の正本が 1 ヶ所**: 15+ モデル (Project / ProjectMember / Venue / VenueScore / Estimate / EstimateItem / Visit / VisitRating / Decision など) を schema-first で扱う
- **TypeScript の型がスキーマから自動生成**: AI agent が Server Action / API route を書くときに、誤った column 名 / 型を書きにくい
- **migration が再現可能**: ローカル → preview → prod の 3 環境で順序通りに走る、 `migrate dev` で履歴生成、 `migrate deploy` で適用
- **Vercel の serverless / Fluid Compute で connection が枯渇しない**: Supabase の pgBouncer (transaction mode) と素直に組み合わさる
- **Postgres の表現力を捨てない**: array column / composite index / partial index / ENUM がそのまま書ける
- **Soft delete の `deletedAt` パターン**を後から導入できる柔軟性 (Phase 1 後半に `35370ff` で追加実施)

選択肢: Prisma / Drizzle / Kysely / 生 SQL + zod。

## Decision

**Prisma 7.x を採用し、Driver Adapters (`@prisma/adapter-pg` の `PrismaPg`) 経由で Supabase の Postgres に接続する**。具体的には:

- `prisma/schema.prisma` を **唯一の正本**。15 モデル / 10 enum / 各種 composite index を schema 一元管理
- 生成先は `src/generated/prisma/` (デフォルトの `node_modules` 配下ではなく、commit 対象外でもコードから直接 import できる位置)
- DB クライアントは `src/server/db.ts` の singleton (Next.js dev の HMR で複数インスタンス化しないガード付き)
- migration は `npx prisma migrate dev --name <name>` で作成、`npx prisma migrate deploy` で本番適用 (`db push` は使わない方針 — `CLAUDE.md` にルール化)
- env は `.env.local` を一次ソース (`prisma.config.ts` から読む `1d14d74`)。`url` (pgBouncer) と `directUrl` (migrate 用 direct connection) を分離

導入は Phase 1 立ち上げ時の `092d285` "feat: add Prisma schema with all data models and constants" で完了。Prisma 7.x 固有の API 差分対応として `d42c1bf` "use --to-schema flag for Prisma 7.x migrate diff" が必要だった。

## Consequences

良かった点:

- **schema.prisma 1 ファイルで DB 全体が把握できる**: 1 人開発 + AI agent でも「ここを読めばいい」が明確 (`CLAUDE.md` でも always-single-writer ファイルとして指定)
- **Prisma Client の型がそのまま Server Action / Route Handler に流れる**: tsc が DB 由来のミスを大量に拾う
- **migration 履歴が `prisma/migrations/<timestamp>_<name>/migration.sql`** で残るため、git diff で「いつ何が変わったか」が追える
- **PrismaPg adapter** で Vercel serverless の cold start でも connection 枯渇が起きにくい設計
- **composite index の追加が schema 側で完結** (Phase 2.D で 4 + 3 件追加: `8c78727` / `f21c6b8`)

悪かった点 / 後始末:

- **Prisma 7 は migrate API が一部変更された** (`d42c1bf` `--to-schema` フラグ対応)。文書が訓練データに乗っていない可能性が高く、AI agent には Context7 で最新ドキュメント確認させる運用が必要
- **soft delete (`deletedAt`) は schema レベルの強制ができない**: 全クエリで `deletedAt: null` を書く必要があり、Prisma の middleware (extension) で全箇所を一括フィルタする運用に倒した
- **N+1 が `include` の書き方で発生しやすい**: Phase 2.D で 6 箇所 sweep が必要になった (`db823d6`)。AI agent には「list 系は select で必要 column のみ」を `CLAUDE.md` 級でルール化したい
- **Prisma client の generate 出力が `src/generated/prisma/` に大きい**: bundle に乗らないよう Server-only で利用する規約が必要 (Server Action / Route Handler 経由のみ)
- **Driver Adapters は Prisma 6 → 7 で stable 化**したが、エラーメッセージが直 SQL に近く debug 経験者でないと読み解きにくい

## Alternatives considered

- **Drizzle**: 軽量で SQL に近い、ただし schema-first ではなく code-first。AI agent が複数ファイルを跨いで table 定義を書きがちで「どこが正本か」が曖昧になる懸念。Phase 1 速度重視で Prisma の規約強制を優先
- **Kysely**: 型安全な query builder。schema 管理は別ツール (Atlas / dbmate) と組み合わせる必要があり、3 種神器を揃える摩擦が高い
- **生 SQL + zod**: 表現力は最大、ただし AI agent に書かせると table / column の typo が runtime まで残る。tsc で防げる量が圧倒的に減るためボツ

「schema.prisma 1 ファイルが正本」という規約強制が AI agent 開発で効く、と判断して Prisma を採用。

## References

- 初期 schema: `092d285` "add Prisma schema with all data models and constants"
- Prisma 7 API 差分対応: `d42c1bf` "use --to-schema flag for Prisma 7.x migrate diff"
- soft delete 導入: `35370ff` "add deletedAt soft-delete columns"
- index 強化: `8c78727` (Phase 2.D 4 件) / `f21c6b8` (round-2 3 件)
- N+1 sweep: `db823d6`
- 関連 ADR: [0002 Supabase](./0002-supabase-as-auth-storage-postgres-host.md)
