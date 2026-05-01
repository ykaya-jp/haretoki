# 0008. Phase 3 docs 自動化 (drift hook + curator + cron) は **段階的 gating** で投入する

- **Status**: Accepted
- **Date**: 2026-05-02
- **Deciders**: yusuke.kaya

## Context

Phase 2.E で 3 つの harness 整備が短期間で連続着地した:

- ADR 0001-0005 (Phase 2.E ADR 導入、 commit 76772b0、 Worker C2)
- ADR-0006 + AI prompts drift 検知 PostToolUse hook (`bca00b8` / `f133b49`、 Worker B)
- `.claude/agents/docs-curator.md` subagent 仕様 (`a4e8772`、 Worker C2)

これらは個別に Accepted な ADR だが、**全体としての運用合意 (= "いつ何を有効化するか")** は明文化されていない。 具体的には:

- ADR-0006 で導入した drift hook は **warn-only** (frontmatter に `stale: true` を立てない、 STDERR 警告だけ)
- `docs-curator` subagent は仕様完成のみ。 GitHub Actions cron は **未有効化**
- `harness-ai-maintenance-plan.md` Phase 3 §5 表に「Phase 2 hook merge 後 1 週間観測」の文言はあるが、 観測項目 / 中断条件 / 再開条件が散らばっている
- ADR 0006 と 0007 で「将来の有効化条件」を個別 ADR 内に書いているが、 Phase 3 全体の **進行手順そのもの** はメタな決定として独立した記録が無い

この状態で誰かが (または将来の AI agent が) cron を有効化したり、 drift hook を warn-only から自動 stale 付与に切替えたりするとき、 「どの順番で / 何を観測してから」 の手順が不明瞭。 Phase 3 の運用合意そのものを ADR として残す必要がある。

## Decision

Phase 3 (docs-curator cron + drift hook の段階的強化) を以下の **gating order** で投入する。 各ゲートをクリアするまで次に進まない。

```
Gate 1 (現在 = 2026-05-02 着地済)
  ├─ ADR 0001-0006 が develop に merge 済
  ├─ AI prompts drift hook (warn-only) が稼働中
  └─ docs-curator spec (.claude/agents/docs-curator.md) merge 済、cron 無効

Gate 2 (1 週間 = ~2026-05-09)
  ├─ drift hook の偽陽性 / 偽陰性を週次観測
  │   ├─ 偽陽性 (= 同 PR で md+ts 同期しているのに警告が出る) ≦ 0 件
  │   ├─ 偽陰性 (= 片方しか直していないのに警告が出ない) ≦ 1 件
  │   └─ 警告ノイズ (= 関係ない編集で警告) ≦ 2 件
  └─ @docs-curator 手動 invoke で 1 回以上 dry-run、PR 起票して質を観測
     (ambiguous / excluded by policy 件数が許容範囲、本文の事実誤りなし)

Gate 3 (Gate 2 通過後)
  ├─ GitHub Actions docs-curator-weekly.yml 追加、ただし最初は workflow_dispatch のみ有効
  ├─ 手動 trigger で 2 回以上 PR 起票、merge 率 ≧ 50% を確認
  └─ 1 週間 cron 化 (毎週月曜 09:00 JST)、PR 滞留 ≦ 3 本

Gate 4 (Gate 3 通過後、optional)
  ├─ drift hook を warn-only から stale: true 自動付与に格上げ判断
  │   (ADR-0006 の "Alternatives considered" で見送った変更を再評価)
  └─ docs-drift-pr-comment.yml で PR 内 drift コメント自動化
```

各 Gate の **中断条件 (kill switch)** も同時に決める:

- **Gate 2 で偽陽性 ≧ 1 件 / ノイズ ≧ 3 件** → drift hook の検出ロジックを見直し、 修正 commit が入るまで Gate 3 に進まない
- **Gate 3 で curator PR の質劣化 (誤った doc 編集 ≧ 1 件 / merge 率 < 50%)** → cron を即停止 (`workflow_dispatch` だけに戻す)、 D1〜D10 の検出パターン (`.claude/agents/docs-curator.md`) を見直し
- **Gate 4 は明確な improvement signal が無ければ実施しない**: warn-only でも drift が解消されているなら自動付与は overengineer

## Consequences

良かった点:

- **Phase 3 進行の意思決定が ADR 1 本に集約される**。 cron を有効化したい人 / Phase 3 を継続したい AI agent はこの ADR だけ読めば次に何をすべきか / 何を観測すべきか / どこで止めるかが分かる
- **kill switch が事前に明文化されている**ため、 偽陽性 PR / 渋滞 / 誤更新が起きたときに「いつ止めるか」議論せずに止められる
- **過剰自動化の防止**: Gate 4 (自動 stale 付与) を optional にしている。 warn-only で十分回るなら格上げしない、 という判断軸を明示
- **将来の AI agent (docs-curator 自身を含む) が Phase 3 の段取りを誤解しない**。 例えば curator が「自分の cron を有効化する PR」を勝手に起票するような動きを ADR が排除する

悪かった点 / 後始末:

- **Gate 2 の観測が人間依存**: 偽陽性 / 偽陰性 / ノイズ件数を週次で集計する仕組みは本 ADR では決めていない。 Gate 2 着手時点で簡易な集計スクリプト (drift hook の STDERR を `~/.claude/logs/` に流す等) を別 sprint で組む必要
- **gating order を厳守すると morph 効果が遅れて見える**: 4 〜 8 週間かけて Gate 4 まで到達する想定。 速度より品質を優先する判断
- **GitHub Actions workflow がまだ無い**: Gate 3 で `docs-curator-weekly.yml` / `docs-drift-pr-comment.yml` を追加する作業は別 PR。 本 ADR は順序とゲートだけ決め、実装そのものは含まない
- **curator が触ってよい / いけない境界 (`.claude/agents/docs-curator.md` の表) は将来も拡大しない**: 「実装コードに触る curator」へ広げる誘惑があるが、 本 ADR は明確に "docs/** + .claude/README.md のみ" のスコープを Gate 4 まで固定する

## Alternatives considered

- **A. Gate 無しで一気に cron 化**: 速いが、 偽陽性 PR が出始めたら一晩で 5+ 本溜まる risk。 PR レビュー側の信頼が崩れたら curator 自体が deprecated に追い込まれる
- **B. Gate 2 をもっと長く (2-4 週間) 取る**: より安全だが、 Phase 3 の momentum を失う。 ADR-0007 の View Transitions も同様の段階投入で 「foundation だけ進める」 戦略を取っており、 1 週間が最小単位として運用と整合
- **C. Gate を kill switch 無しで定義**: kill switch 無しの自動化は典型的な失敗モード。 偽陽性が出始めても "もう少し様子を見よう" で止められなくなる
- **D. drift hook を最初から自動 stale 付与で実装**: ADR-0006 で既に却下済 (frontmatter 自動編集 → file watcher と prettier hook の race / 編集途中の file に sed 走る等の事故ベクタ)。 Gate 4 で再評価するのみ
- **E. curator を model: opus にアップグレード**: 偽陽性削減には効くかもしれないが、 cost が大幅増 + Gate 2 の観測前に変えるのは早すぎる。 Gate 3 通過後に検討

## References

- 関連 ADR: [0005 prompt md canonicalization](./0005-claude-prompt-canonicalization-in-md.md) / [0006 drift detection PostToolUse hook](./0006-ai-prompts-drift-detection-via-posttoooluse-hook.md) / [0007 View Transitions scoped prototype](./0007-view-transitions-scoped-prototype-not-spa-default.md) (段階投入パターンが共通)
- 関連仕様: `.claude/agents/docs-curator.md` (D1〜D10 検出 / PR body / 触る境界) / `docs/harness-ai-maintenance-plan.md` Phase 3 §5
- 関連 commit: `bca00b8` / `f133b49` (drift hook) / `a4e8772` (curator spec) / `76772b0` (ADR 制度)
- Phase 3 進行は本 ADR を **正本** として `docs/PENDING.md` E. Harness 自動化セクションから参照
