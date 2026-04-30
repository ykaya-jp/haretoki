# docs/ 索引

Haretoki プロジェクトの設計書・ロードマップ・運用手順・監査記録の格納場所。
**ルートの `CLAUDE.md` / `AGENTS.md` がエージェント入口、ここはその参照先**。

## サブディレクトリ

| ディレクトリ | 内容 | 入口ファイル |
|---|---|---|
| [`ai/`](ai/) | Claude API 関連: モデル ID 対応表、ガードレール、プロンプト仕様 | [`ai/models.md`](ai/models.md) |
| [`harness/`](harness/) | 開発基盤: 並列開発 runbook、`.claude/settings.json` hook 定義 | [`harness/runbook.md`](harness/runbook.md) |
| [`designs/`](designs/) | 進行中機能の 5 層設計書 (Wave 15: F1-F4) | [`designs/README.md`](designs/README.md) |
| [`plans/`](plans/) | 進行中の実装 plan | (該当 sprint の md) |
| [`myreview/`](myreview/) | 実ユーザー (妻) フィードバック起点の audit 記録 | [`myreview/README.md`](myreview/README.md) |
| [`superpowers/specs/`](superpowers/specs/) | 非機能要件・性能予算 | [`superpowers/specs/2026-04-13-nonfunctional-requirements.md`](superpowers/specs/2026-04-13-nonfunctional-requirements.md) |
| [`archive/`](archive/) | 役目を終えた / 上書きされた / 実行済みの履歴。参照のみ | [`archive/README.md`](archive/README.md) |

## 直下のファイル

| ファイル | 役目 |
|---|---|
| [`roadmap.md`](roadmap.md) | Release 1-4 統合ロードマップ (機能の出し分け) |
| [`lessons.md`](lessons.md) | 失敗・気づき記録 (繰り返さないため) |
| [`copy-lexicon.md`](copy-lexicon.md) | コピー表現置換辞書 (Tone of Voice) |
| [`harness-ai-maintenance-plan.md`](harness-ai-maintenance-plan.md) | docs drift 自動検知計画 (Phase 1 完了 / Phase 2-3 は **Future Plan** — [`PENDING.md`](PENDING.md) 参照) |
| [`PENDING.md`](PENDING.md) | **計画したが未実装のもの一覧**。やる/やらないの判断材料 |

## ルール

- **新しいトピックを追加するとき**: 既存サブディレクトリに収まるか先に検討。収まらないときだけ新ディレクトリ
- **役目を終えた doc**: `archive/` に `git mv`。`archive/README.md` の表に 1 行追加
- **drift 防止**: 実装が進んだら対応する doc を同 PR で更新。出来ない場合は `lessons.md` に記録して `PENDING.md` へ追加
