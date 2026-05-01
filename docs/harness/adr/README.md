# Architecture Decision Records (ADR)

Haretoki の技術的な意思決定を **後で読んで再現できる形** で残す台帳。
コードや commit message は「何をどう変えたか」を残せるが、「なぜその選択肢を採り、何を捨てたか」は残らない。
ADR はそこを埋める。

## いつ書くか

以下に該当する変更は **コードの merge と同 PR で ADR を 1 本入れる**:

- 言語 / フレームワーク / 主要ライブラリの採用・廃止 (Next.js / Prisma / Supabase / framer-motion / Anthropic SDK 等)
- DB スキーマの不変条件に影響する設計 (RLS 方針、ID 戦略、ソフト削除、index 戦略)
- 認証 / 認可 / セッション / cookie の取り扱いを変える決定
- AI 呼び出しの正本を移す決定 (例: prompts md 化、モデル ID 集中管理)
- パフォーマンス / レンダリング戦略の方針転換 (App Router 採用、`cacheComponents`、PPR、virtual scroll)
- 並列開発 / harness 自体の運用ルール変更
- ユーザーが実際に体験する UX の **不可逆な決定** (4 タブ構成、進捗バー廃止、暗色テーマでの opacity → color-mix migration 等)

逆に書かなくて良いのは: bug fix、refactor、rename、依存の minor / patch bump、テキスト修正、単発 sprint タスク。
迷ったら「6 ヶ月後に同じ判断を聞かれて理由を即答できるか」で決める。即答できないと感じたら書く。

## 形式: Nygard 形式 (短い ADR)

[MADR](https://adr.github.io/madr/) 等の長いテンプレもあるが、Haretoki は **1 人〜少人数 + AI agent 開発** なので、書く側 / 読む側の摩擦を最小にする Nygard 形式で統一する。

最低限必要なセクション:

```markdown
# <番号 4 桁>. <短いタイトル>

- **Status**: Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
- **Date**: YYYY-MM-DD
- **Deciders**: <username>(s)

## Context
<どういう状況・制約・要求があったか。事実のみ書く。>

## Decision
<採った選択肢を 1〜3 文で。>

## Consequences
<その結果生まれた良い点 / 悪い点 / 後始末の必要なもの。>

## Alternatives considered
<比較した他の選択肢。なぜ落としたか。>
```

書き方のコツ:

- **Context は事実、Decision は判断、Consequences は結果**。混ぜない
- 推測で書かない。git log / docs / 当時の PR で根拠取れない部分は書かない
- 1 ADR = 1 決定。複数の決定が絡むなら別 ADR に分ける (cross-reference は OK)
- 200〜600 行の長文は赤信号。読まれない ADR は無いのと同じ

## 命名規約

```
docs/harness/adr/<NNNN>-<kebab-case-title>.md
```

- 番号は 4 桁ゼロ埋め (`0001`, `0002`, ...)
- 番号は **連番、欠番なし、二度と振り直さない** (Superseded されても番号は残す)
- タイトルは英語 kebab-case で 5 単語以内 (`0004-color-mix-migration-for-dark-mode-parity` が上限目安)
- 本文は **日本語**。Haretoki は日本語ドキュメントが正本

## Status の遷移

```
Proposed → Accepted → (Deprecated | Superseded by NNNN)
```

- **Proposed**: PR を出した時点。まだ merge されていない
- **Accepted**: PR が merge された時点で書き換える
- **Deprecated**: もう推奨しないが、置き換えはまだない
- **Superseded by ADR-XXXX**: 後続の ADR に置き換えられた。冒頭で必ず後続 ADR にリンク

Status 変更時は **新しい commit で行う** (rebase / amend で履歴を消さない)。「いつ Deprecated になったか」が ADR 自身の履歴で追えるようにする。

## 既存決定の retroactive ADR

ADR 制度導入 (2026-05-02) より前の決定は **重要なものだけ後追いで起票する**。
全部書く必要はない。Phase 2.E 導入時点で起票したのは以下:

- [0001 Next.js 16 App Router を採用する](./0001-nextjs-16-app-router.md)
- [0002 Supabase を Auth / Storage / Postgres ホストとして採用する](./0002-supabase-as-auth-storage-postgres-host.md)
- [0003 Prisma 7 + PrismaPg adapter を ORM に採用する](./0003-prisma-7-with-prismapg-adapter.md)
- [0004 ダークモード対応で `bg-token/opacity` を `color-mix` に置き換える](./0004-dark-mode-color-mix-over-opacity.md)
- [0005 Claude prompt の正本を `docs/ai/prompts/*.system.md` に置く](./0005-claude-prompt-canonicalization-in-md.md)
- [0006 AI prompts drift 検知を PostToolUse hook + warn-only で実装する](./0006-ai-prompts-drift-detection-via-posttoooluse-hook.md)

retroactive ADR は **当時の commit / docs / PR を根拠として引用する**。
書き手の記憶や推測で「たぶんこういう理由だった」を書かない。根拠が見つからないものは書かない判断をする。

## レビュー / 更新

- ADR は merge 後も修正可能だが、**Decision を書き換えない**。Decision が変わるなら新 ADR を起票して旧 ADR を `Superseded by NNNN` にする
- typo / 誤った Context の訂正は OK。その場合は同 PR の commit message にどこを直したかを書く
- ADR を書き換える PR は ADR 作者以外のレビューを 1 人通す (今は AI reviewer agent でも可)

## 周辺ドキュメントとの関係

- `CLAUDE.md` / `AGENTS.md`: AI agent の **行動規範** (今やる / やらない)。期限がない
- `docs/roadmap.md` / `docs/PENDING.md`: **やる予定 / 終わったもの** のリスト
- `docs/lessons.md`: **失敗から学んだこと**
- `docs/plans/YYYY-MM-DD-<topic>.md`: **実装計画書**
- ADR (本ディレクトリ): **取り返しのつかない / 取り返しに重い決定そのもの**

「行動規範に書くか / ADR に書くか」迷ったら:

- ルール (毎回守れ): `CLAUDE.md` / `AGENTS.md`
- 1 回限りの選択: ADR
