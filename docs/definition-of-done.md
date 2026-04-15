# Definition of Done (DoD)

Release / Sprint ごとの **完了条件**。これを満たすまで次フェーズに進まない。逆にこれを満たしたら「完了」と宣言する。

最終更新: 2026-04-15

---

## Release 1 — UI Foundation 全体 DoD

妻 1 人でも使い切れる MVP として成立する条件。

- ✅ 妻が自分のアカウントでログインし、1 件の式場を URL or 手動で追加できる
- ✅ 候補に追加して評価（6 次元）を付けられる
- ✅ 2 件以上の候補を比較（`/compare` or 比べるタブ）で並べて見られる
- ✅ 1 件を「決める」で最終決定できる、取り消しもできる
- ✅ AI コーチに質問して **テンプレではない** 個別化応答が返る（10 質問中 1 回以下しかテンプレ応答しない）
- ✅ モバイル 375px で全画面「縦長すぎ・スペース無駄」と感じない
- ✅ 妻が「決められない」と感じる瞬間が動線上に無い（迷う UI を無くす）
- ✅ Lighthouse mobile で LCP < 1.8s / INP < 200ms / CLS < 0.1
- ✅ 本番で主要 Server Action が p95 < 500ms

### R1 未達ブロッカー（現時点）
- テンプレ応答ループ（F-23 実機検証待ち）
- デザイン「ださい・スペース無駄」系（F-14/F-21 ほか）
- フィルタ UI 未整備（WG-07/08/09）
- 実機計測未実施

---

## Sprint 1 DoD（リサーチ）
- `docs/design-research.md` が存在、各対象画面に 1 段落の方針
- `bug-tracker.md` に Impact × Effort 列が付与され上位 10 件が Priority 1-3
- `phase3-metrics.md` に Phase 1 ベースライン値が記入

## Sprint 2 DoD（5 画面 1 batch 刷新）
- Refero 方針通りに 5 画面（Home / Coach / AddSheet / Compare / DecisionCeremony）がリデザイン
- 妻観察セッションで各画面に肯定コメントが取れる
- `bug-tracker.md`: F-01 / F-04 / F-05 / F-10 / F-14 / F-17 / F-18 / F-21 / B-13 が Closed

## Sprint 3 DoD（チェックリスト + フィルタ）
- `/checklist` 初回動線が明示され、迷わず到達できる
- `/compare` で観点フィルタができる
- 持ち込み料 / 支払い方法 のフィルタ UI が /explore に追加
- `bug-tracker.md`: F-06 / F-07 / F-08 / F-19 / F-20 が Closed
- `wife-requirements-gaps.md`: WG-01/02/03/07/08 が削除

## Sprint 4 DoD（R2 AI 本格化）
- コーチへの 10 質問中テンプレ応答 1 回以下
- 実 URL（1 件以上）で口コミ AI 要約が動く
- PDF 1 本の 80% 以上が自動構造化
- Vercel AI Gateway 経由に統一

## Sprint 5 DoD（仕上げ + 計測）
- 全画面で「プロジェクト」「タスク」「編集」等の業務ワードが消えている
- Apple 風のセクション間遷移モーションが入っている（prefers-reduced-motion 対応）
- ダークモードがトグルで切替可能
- Phase 1 の before/after 計測レポートが `phase3-metrics.md` に記入

---

## Release 2 DoD
- AI 境界が拡張: コーチ自由対話・PDF 解析・口コミ要約・比較分析すべて Claude で動く
- Claude API コストがユーザー当たり月 $1 以内に収まる（キャッシュ戦略）

## Release 3 DoD
- Visit スケジュール→見学中→見学後記録 が一連で回る UI
- パートナー Level 2-3（双方星評価・リアルタイム同期）が動作

## Release 4 DoD
- PWA インストール可 + オフライン基本動作
- Google OAuth 有効
- ダークモード / 通知頻度モード 本実装
