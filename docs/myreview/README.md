# myreview/ — ユーザーフィードバック発の Audit サイクル

実ユーザー (オーナーの妻) フィードバックを起点に、3 トラック並列で audit を実行した記録。実装は別 sprint で対応。

## 入力 (起点)

| ファイル | 内容 |
|---|---|
| [`problems_02.md`](problems_02.md) | 最新 (#11-#16 系) フィードバック。バグ 5 + UX 5 |

> `problems_01.md` は履歴ファイルで現存しないが、`audit-master-A.md` 等から番号で言及されている。

## 3 トラックの分担

| Track | 対象 | 実行 prompt | 主要 output |
|---|---|---|---|
| **A** UI/UX 審美 | 14 画面の editorial 性 | [archive/2026-04-17-audit-a-prompt.md](../archive/2026-04-17-audit-a-prompt.md) | [`uiux-aesthetic-audit.md`](uiux-aesthetic-audit.md) (320 KB の本体) + [`audit-master-A.md`](audit-master-A.md) (決定版サマリ) + sub-A1〜A4 |
| **B** Performance | タップ→反応 / 体感速度 | [archive/2026-04-17-audit-b-prompt.md](../archive/2026-04-17-audit-b-prompt.md) | [`performance-audit.md`](performance-audit.md) |
| **C** Harness & AI Docs | 開発基盤・AI 運用 docs | [archive/2026-04-17-audit-c-prompt.md](../archive/2026-04-17-audit-c-prompt.md) | [`../harness-ai-maintenance-plan.md`](../harness-ai-maintenance-plan.md) |

## Track A の構造 (Source of Truth)

```
problems_02.md (起点)
        │
        ├── audit-sub-A1.md  (ホーム / 探す / 候補 / Duel)
        ├── audit-sub-A2.md  (コーチ / オンボ)
        ├── audit-sub-A3.md  (式場詳細 / 比較 / Journey)
        ├── audit-sub-A4.md  (checklist / visits / mypage / auth / landing)
        ├── uiux-aesthetic-audit.md  (横串の本体報告)
        │
        └──→ audit-master-A.md  ★ 決定版 (重複・矛盾解消後の SOT)
```

**実装計画はすべて `audit-master-A.md` を参照する**。sub-A1〜A4 は audit の根拠・現状スコアを残すための背景資料。

## 実行サイクル (再利用テンプレ)

新しい spectator フィードバックが来たら同じ流れで:

1. **問題列挙**: `problems_NN.md` 追加 (起点)
2. **prompt 起こす**: `audit-{a,b,c}-prompt.md` を Track 別に書く (worktree で plan mode 実行を想定)
3. **並列実行**: 3 worktree で plan mode 走らせ、output を本ディレクトリに集約
4. **決定版作成**: 重複・矛盾解消した `audit-master-X.md` を 1 ファイルにまとめる
5. **prompt を archive へ移動**: 実行済み prompt は `docs/archive/YYYY-MM-DD-audit-X-prompt.md` に退避
6. **実装 sprint へ引き継ぎ**: 新規 plan を `docs/plans/` に作成、master を SOT として参照

## 注意

- audit 系 md は **読み物**。実装はしない (各 doc 冒頭にも記載)
- ファイルが大きい (uiux-aesthetic-audit は 320 KB 越え)。grep で部分参照を推奨
- `problems_01.md` 等の歴史参照は dead link になっているが audit 履歴の一部として残す
