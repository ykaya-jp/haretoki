# 0004. ダークモード対応で `bg-token/opacity` を `color-mix` に置き換える

- **Status**: Accepted
- **Date**: 2026-05-01 (`f0a4b07` / W21-5) / 2026-05-02 (retroactively recorded)
- **Deciders**: yusuke.kaya

## Context

Phase 2.C でダークモード本格対応を実施 (`67126b3` "Phase 2.C dark-mode parity across 7 main screens")。その後 Phase 2 の audit (Track A / 妻フィードバック由来) で **暗色テーマでは `bg-[var(--gold-subtle)]/30` のような token + opacity ramp が、背後の surface と同色化して "差分" が見えなくなる** 事象が複数面で発覚:

- 通知一覧の **未読行ハイライト**: 既読行と区別がつかない
- 通知一覧の "すべて既読にする" ボタンの **rest / hover 状態 ramp**: ramp 差が消える
- ランディングの **ベネフィットパネル**: パネル背景が抜ける
- 比較ボードチェックリストの **「差分あり」ハイライト**: 差分 cell が浮き上がらない

原因: `bg-[var(--gold-subtle)]/30` は CSS の `background-color: rgb(... / 0.3)` に展開され、 ライト時は薄ベージュ (gold-subtle = 暖色) が浮くが、ダーク時は周囲の暗色 surface と alpha-blend されて中間色 ≒ surface 色 になる。 「opacity を増やせば見える」のは事実だが、ライト側が濃すぎて目立ちすぎる ↔ ダーク側で見える、のトレードオフが取れない。

対策候補は次のいずれか:

1. ダーク用 token を `--gold-subtle-dark` で別定義し、 `dark:bg-[...]` で出し分ける
2. opacity ramp をやめて `color-mix(in <space>, <color> <%>, <surface>)` で **surface と固定比で混ぜる**
3. SVG / 画像で highlight を描く

## Decision

**`color-mix(in oklab, var(--gold-warm) <N>%, <surface>)` で「surface と固定比で混ぜる」方式に統一する**。

具体的な置き換えパターン (W21-5 / `f0a4b07`):

| 用途 | 旧 | 新 |
|---|---|---|
| Card 内ハイライト (notification 未読 / checklist diff) | `bg-[var(--gold-subtle)]/30` | `bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--card))]` |
| Page 背景上のパネル (landing benefits) | `bg-[var(--gold-subtle)]/30` | `bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))]` |
| Hover ramp (mark-all-read button) | `/30 → /60` | `6% → 12%` (両方 `color-mix` against `--background`) |
| Checklist 差分強調 | `bg-[var(--gold-subtle)]/40` | `bg-[color-mix(in_oklab,var(--gold-warm)_8%,var(--card))]` |

surface の選び方は **callsite の親コンテナに合わせる**:
- Card の中で highlight するときは `var(--card)`
- Page 直下や hero / panel のように page 背景の上に乗っているときは `var(--background)`

## Consequences

良かった点:

- **ライト / ダークどちらでも highlight が常に見える**: surface 色を base にして固定比でゴールドを混ぜているため、結果色は両テーマで「ベース + 固定量のゴールド」になる
- **`oklab` 色空間で混ぜている**ため、 hue がねじれず perceptually 自然なグラデーションになる
- **Tailwind の任意値 `bg-[...]` で 1 行**で書けるため、別 token 定義を増やさない (`--gold-subtle-dark` を作る案より小さく済む)
- **ダーク / ライト で別 className を出し分けない**ため、SSR のチラツキ (`dark:` class が hydrate 前に当たらない問題) を踏まない

悪かった点 / 後始末:

- **`color-mix` の Tailwind 任意値は記法が長い**: `bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--card))]` は読みにくい。今後同じパターンが増えるなら `tw-gold-mix-6` のような shortcut utility を Tailwind config に登録するか検討
- **`color-mix` のブラウザ対応**: Safari 16.4+ / Chrome 111+。Haretoki は最新モバイルブラウザ前提なので問題ないが、 サポート対象が広がるときは fallback 検討が必要
- **`active:bg-[...]/60` のような press-state は今回スコープ外**: <200ms のタップ瞬時状態はダーク collapse が perceive しにくいため、ROI が低くスキップ (`f0a4b07` commit message に明記)
- **将来的に gold-warm 以外のアクセント (例: 失敗系 red、成功系 green) に同パターンを横展開する**ときに、callsite 4 ヶ所だけ直しても unified ではない。色 token 単位で migration する判断が再度必要

## Alternatives considered

- **`--gold-subtle-dark` 等のダーク専用 token + `dark:bg-[...]` 出し分け**: 動くが、token が倍増する / `dark:` の SSR チラツキ / 任意値の冗長さが課題。 token を増やさず callsite を直すほうが安い、と判断
- **`backdrop-filter` / `filter` で highlight 表現**: ダークでも見える可能性はあるが、performance hit / 重なり順序のバグが出やすく、4 ヶ所のために導入する価値がない
- **opacity を上げる (`/30 → /60`) のみ**: ライト側が濃すぎる。ダーク fix のためにライト品質を犠牲にできない
- **画像 / SVG で highlight 描画**: bundle / メンテ コストが釣り合わない

「callsite 4 ヶ所を `color-mix` に置き換えるだけで、token 増やさず両テーマで安定する」のが最小手のため採用。今後 audit で類似パターン (token + `/N` opacity) を見つけたら、 同じ migration を **不可逆な方針として** 適用する。

## References

- 主 commit: `f0a4b07` "fix(theme): replace token /opacity bg with color-mix for dark-mode parity"
- 前提となるダークモード本実装: `67126b3` "Phase 2.C dark-mode parity across 7 main screens"
- 由来 audit: Phase 2 audit P2-9 (W21-5 sprint)
- 関連 ADR: なし (UI surface 個別の決定)
