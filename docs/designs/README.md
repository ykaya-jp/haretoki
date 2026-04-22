# haretoki Feature Design Specs

機能ごとの 5 層設計ドキュメントを置く場所です。

非機能要件 (性能予算など) は `docs/superpowers/specs/` に分離しています。

## 5 層テンプレート

1. **基本設計** (Foundation) — Purpose / Scope / Non-goals / Persona / Success metrics / データフロー
2. **詳細設計** (Technical) — Prisma schema delta / Server Actions / Component tree / Error paths / Caching
3. **画面設計** (Screens) — State matrix / wireframe / 375px / dark mode
4. **ユーザー体験設計** (Journey) — User journey / emotion arc / コピー / edge cases / 離脱リカバリ
5. **UI/UX 設計** (Tokens & Micro-interactions) — DESIGN.md トークン参照 / motion / accessibility / dark mode / micro-interactions

## Wave 15 (2026-04-22) 設計対象

不便ポイント audit で見つかった優先度 A の 4 件:

| ID | 機能 | 担当ファイル | 目的 |
|---|---|---|---|
| **F1** | 式場名検索で追加 | [f1-venue-name-search.md](./f1-venue-name-search.md) | URL コピペ 3 ホップを削減、初回体験の最大摩擦を消す |
| **F2** | 見学カレンダー連携 (.ics) | [f2-visit-calendar-ics.md](./f2-visit-calendar-ics.md) | 個人カレンダーとの二重管理を解消 |
| **F3** | 決定後の次アクション todo | [f3-post-decision-todo.md](./f3-post-decision-todo.md) | 決定で終わる印象を反転、実務タスクへ橋渡し |
| **F4** | パートナー招待摩擦削減 | [f4-partner-invite-friction.md](./f4-partner-invite-friction.md) | Level 1 guest mode で「とりあえず見て」を無摩擦化 |

各文書は designer agent が執筆 → design-reviewer agent が 6 観点 (仕様漏れ / 既存コンポーネント活用 / 画面状態網羅 / エッジケース / A11y / dark mode) で査定 → reviewer 指摘を orchestrator が反映した状態です。

## 依存

- [DESIGN.md](../../DESIGN.md) v4.2 — Single Source of Truth
- [docs/copy-lexicon.md](../copy-lexicon.md) — コピー辞書
- [docs/superpowers/specs/2026-04-13-nonfunctional-requirements.md](../superpowers/specs/2026-04-13-nonfunctional-requirements.md) — 性能予算
