# Phase / Release / Sprint 対応表

Haretoki では複数の時間軸の呼び名が混在している。**既存ドキュメントは書き換えない**で、この対応表で横串を通す。

最終更新: 2026-04-15

---

## 3 つの軸

| 軸 | 何を表すか | 定義元 |
|---|---|---|
| **Release 1-4** | 機能リリースのメジャーバンド | `docs/roadmap.md` |
| **Phase 0-4** | Release 1 の内部イテレーション（改善サイクル） | `docs/myreview/remediation-master-plan.md` |
| **Sprint R-6** | 次セッション以降の実行単位（本 PM プラン） | `docs/pm-plan.md` |

---

## 対応表

| Sprint | Phase | Release | スコープ要約 | 状態 |
|---|---|---|---|---|
| — | Phase 0（hotfix） | R1 内 | 本番エラー緊急対応（H0-1〜H0-7） | ✅ 完了 2026-04-14 |
| — | Phase 1（perf） | R1 内 | 体感速度底上げ（P1-1〜P1-7） | ✅ 実装完了、**実機計測 Sprint 1 で実施** |
| — | Phase 2（IA 再設計） Tier 1 | R1 内 | ホーム NBA / 探す FAB / 詳細 dl / ソート等 | ✅ 完了 2026-04-14 |
| — | Phase 2（IA 再設計） Tier 2 | R1 内 | Coach sessions / 詳細 sticky tabs / Combobox / 0.5 評価 / W-3/4/5 | ✅ 完了 2026-04-14 |
| — | Phase 3（Visual + §0 Checklist） | R1 内 | Atmospheric Layers v4.1 / 横比較チェックリスト基盤 | ✅ 完了 2026-04-14 |
| — | Phase 3.5（品質回復 hotfix） | R1 内 | 妻フィードバック対応 multi-wave | 🟢 主要完了、実機検証待ち（Sprint 1） |
| **Sprint R** | — | R1 完成準備 | PM 資産再整備 | ✅ 本セッション完了 |
| **Sprint 1** | Phase 1 計測 + Phase 4 準備 | R1 内 | 妻観察・Refero 10 画面・Lighthouse 計測・bug-tracker 再ランク | 🔴 次セッション開始 |
| **Sprint 2** | Phase 4a（UI 刷新） | R1 Done 直前 | ホーム/コーチ/Sheet/比較/決定 5 画面 1 batch デザイン刷新 | 🔴 |
| **Sprint 3** | Phase 4b（UX 完成） | R1 Done 直前 | チェックリスト動線 + 観点フィルタ + 持込料/支払フィルタ | 🔴 |
| **Sprint 4** | R2 着手 | Release 2 | Claude API 本格接続（コーチ自由対話 / 口コミ要約 / PDF 解析 / 比較分析） | 🔴 |
| **Sprint 5** | Phase 4c（仕上げ） | R1 Done + R4 一部前倒し | コピー全面素敵化 / モーション予算 / ダークモード / Safari 戻る | 🔴 |
| **Sprint 6** | R3 + R4 | Release 3, 4 | Visit UI / Partner L2-3 / Realtime / PWA / Google OAuth | 🔴 |

---

## 旧呼称 → 新呼称

旧ドキュメントで出てくる呼び方を、現行 Sprint/Release 体系に翻訳する表。

| 旧ドキュメントの呼び名 | 現行 | 備考 |
|---|---|---|
| 「Phase 1（コア機能）」旧 | R1 相当の初期ビルド | `archive/2026-04-12-phase1-core-comparison.md` |
| 「Phase 1.5a/b/c」 | R1 内の妻要望対応ウェーブ | `wife-requirements-plan.md` で詳細 |
| 「Phase 5 決定支援」旧 | R1 の決定機能として統合済 | — |
| 「Phase 6 パートナー再招待」旧 | R3 の Level 2-3 に統合 | — |
| 「Phase 7 Modern Luxury」旧 | Phase 3 visual + Sprint 2/5 に分割 | `superpowers/specs/2026-04-14-phase7-modern-luxury-polish.md` |
| 「Phase 2（IA 再設計）」 | Tier 1 + Tier 2 ともに完了 | 本表の通り |
| 「Phase 3（ビジュアル刷新）」 | 完了（Atmospheric Layers v4.1） | 本表の通り |
| 「Phase 4（仕上げ）」 | Sprint 2 + Sprint 3 + Sprint 5 に分散 | 次セッション以降 |

---

## 判読ルール

- **今後新規ドキュメントは「Sprint N / Release R」表記** で統一
- 既存ドキュメントの「Phase X」表記は**触らない**（歴史の証拠）
- 読み手は本表を介して変換する
- 古い呼称を壊したくなったら本表だけ更新すれば済む

---

## 章立ての優位順位

判断が割れた時の優先順位:

1. `docs/status-dashboard.md`（現在状態の最新真実）
2. `docs/pm-plan.md`（次にやること）
3. `docs/roadmap.md`（当初マスタープラン）
4. 個別 spec / plan（歴史的経緯）
