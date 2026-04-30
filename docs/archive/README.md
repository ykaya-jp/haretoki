# Archive

役目を終えた・上書きされた・実行済みのドキュメント置き場。**参照のためだけに保持** している。ここを編集しても最新仕様は変わらない。

## 含まれるもの

### 旧 Release / 旧設計 (2026-04-12 〜 2026-04-15)

| ファイル | 元の役目 | 引き継がれたもの |
|---|---|---|
| `2026-04-12-phase1-core-comparison.md` | 旧 Phase 1-5 体系 | → `docs/roadmap.md`（Release 1-4） |
| `2026-04-12-venuelens-design.md` | v1 技術設計 | → `2026-04-13-venuelens-v2-redesign.md` |
| `2026-04-13-release1-technical-spec.md` | Release 1 技術設計 | → 実装済 / `docs/roadmap.md` |
| `2026-04-13-release2-technical-spec.md` | Release 2 技術設計 | → `docs/roadmap.md` Release 2（未実装） |
| `2026-04-13-release3-technical-spec.md` | Release 3 技術設計 | → `docs/roadmap.md` Release 3（未実装） |
| `2026-04-13-release4-technical-spec.md` | Release 4 技術設計 | → `docs/roadmap.md` Release 4（未実装） |
| `2026-04-13-revised-roadmap.md` | Phase 1.5 計画 | → `docs/roadmap.md` に吸収 |
| `2026-04-13-venuelens-v2-redesign.md` | v2 UI/UX 全画面仕様 | → `DESIGN.md` v4.2 + `docs/designs/` |
| `2026-04-14-harenohi-overhaul-design.md` | 旧ブランド名 (晴れの日) overhaul 案 | → 「晴れ時 (Haretoki)」へリネーム後、`DESIGN.md` |
| `2026-04-14-phase1a-security-ux-fixes.md` | 実装完了済 executable plan | → `docs/lessons.md` の教訓 |
| `2026-04-14-phase7-modern-luxury-polish.md` | フェーズ 7 計画 | → `DESIGN.md` v4.2 editorial refresh |
| `i18n-migration.md` | EN 展開計画 | 海外展開時に復活 |

### 実行済み audit prompt (2026-04-17)

各 prompt は plan mode で実行され、output ドキュメントが残っている。prompt 自体は履歴として保存。

| ファイル | Track | output |
|---|---|---|
| `2026-04-17-audit-a-prompt.md` | Track A: UI/UX 審美 | `docs/myreview/uiux-aesthetic-audit.md` + `audit-master-A.md` + `audit-sub-A1〜A4.md` |
| `2026-04-17-audit-b-prompt.md` | Track B: Performance | `docs/myreview/performance-audit.md` |
| `2026-04-17-audit-c-prompt.md` | Track C: Harness AI Docs | `docs/harness-ai-maintenance-plan.md` |

### 完了した実装 plan (2026-04-19)

| ファイル | 元の役目 | 結果 |
|---|---|---|
| `2026-04-19-v4-url-import-final.md` | URL 取込 v4 統合実装計画 | 実装済（develop に merge 済） |

## ルール

- **編集しない**: 履歴として保存しているだけ。修正したいなら active な doc 側で
- **削除はしない**: git history で復元できるが、grep のヒット先として履歴が残っている方が便利
- **新規追加**: 役目を終えた doc が出たら本ファイルの表に 1 行追加してから `git mv` する
