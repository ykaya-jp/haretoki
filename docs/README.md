# Haretoki — Docs インデックス

**プロジェクト全体を最短で把握するための入口**。まずここから読む。

最終更新: 2026-04-15

---

## 🎯 Now / Next / Later

### Now（今着手中）
- **Sprint R: PM 再整備 + 妻実観察**（このセッションで完了）
- 次セッション投入予定の一投プロンプト → [`next-session-prompt.md`](./next-session-prompt.md)

### Next（次セッション、優先順に）
1. **Sprint 1: Refero リサーチ + デザイン方針決定**（実装 0、分析 + 提案のみ）
2. **Sprint 2: ホーム / コーチ / 追加 Sheet / 比較 / 決定セレモニー 刷新**（5 画面 1 batch）
3. **Sprint 3: チェックリスト UX（F-19/F-20）+ フィルタ追加**（妻要望の核）
4. **Sprint 4: R2 Claude API 本格導入**（コーチ自由対話・口コミ要約・PDF 解析）

→ 詳細シーケンス: [`pm-plan.md`](./pm-plan.md)

### Later（明記してスコープ外）
- R3 Visit UI / Partner Level 2-3 / Realtime 同期
- R4 PWA / オフライン / Google OAuth / ダークモード本実装
- Zexy 等スクレイピング（headless browser or 法務整理）
- 海外展開 / i18n

---

## 🔍 Single Source of Truth 表

### 第一に見るもの（PM / 引継ぎ用）
| 目的 | ファイル |
|---|---|
| **3 軸ステータス（機能・非機能・UX）** | [`status-dashboard.md`](./status-dashboard.md) |
| **課題・バグ一元管理（Open）** | [`bug-tracker.md`](./bug-tracker.md) |
| **完了履歴（恒久）** | [`completed-archive.md`](./completed-archive.md) |
| **妻要望のギャップ** | [`wife-requirements-gaps.md`](./wife-requirements-gaps.md) |
| **PM スケジュール + Sprint 運営** | [`pm-plan.md`](./pm-plan.md) |
| **完了定義（DoD）** | [`definition-of-done.md`](./definition-of-done.md) |
| **次セッション投入プロンプト** | [`next-session-prompt.md`](./next-session-prompt.md) |
| **GTM 粗書き** | [`gtm-draft.md`](./gtm-draft.md) |

### 方針・仕様・ロードマップ
| 目的 | ファイル |
|---|---|
| **全体ロードマップ（Release 1-4）** | [`roadmap.md`](./roadmap.md) |
| **妻要望 原文（§0 北極星）** | [`wife-requirements.md`](./wife-requirements.md) |
| **妻要望実装計画** | [`wife-requirements-plan.md`](./wife-requirements-plan.md) |
| **デザインシステム** | [`/DESIGN.md`](../DESIGN.md) |
| **UX 方針詳細** | [`myreview/ui-ux-remediation-plan.md`](./myreview/ui-ux-remediation-plan.md) |
| **不足デザイン資産 TODO** | [`design-todo.md`](./design-todo.md) |
| **非機能要件** | [`superpowers/specs/2026-04-13-nonfunctional-requirements.md`](./superpowers/specs/2026-04-13-nonfunctional-requirements.md) |
| **実装状況棚卸（詳細）** | [`feature-inventory.md`](./feature-inventory.md) |

### 参考（歴史・監査）
| 目的 | ファイル |
|---|---|
| **妻の原文フィードバック** | [`myreview/problems_01.md`](./myreview/problems_01.md) |
| **Phase 3 監査レポート** | [`myreview/phase3-audit.md`](./myreview/phase3-audit.md) |
| **開発中の教訓** | [`lessons.md`](./lessons.md) |
| **計測フォーマット** | [`phase3-metrics.md`](./phase3-metrics.md) |

### 参照用（詳細設計）
- [`superpowers/specs/2026-04-13-venuelens-v2-redesign.md`](./superpowers/specs/2026-04-13-venuelens-v2-redesign.md) — 11画面 UI 仕様
- [`superpowers/specs/2026-04-13-release*-technical-spec.md`](./superpowers/specs/) — R1-R4 技術設計
- [`superpowers/specs/2026-04-14-phase7-modern-luxury-polish.md`](./superpowers/specs/2026-04-14-phase7-modern-luxury-polish.md) — R4 仕上げ案

### Archive
- [`archive/`](./archive/) — 上書き済 / 役目終了ドキュメント

---

## 📋 用語・体系

- **Release 1-4**: 機能リリース単位（UI Foundation / AI / Visit+Partner / Polish）
- **Phase 0-4**: Release 間の改善イテレーション（hotfix / perf / IA / visual / finish）
- **Sprint N**: 次セッション以降で切る実行単位（このインデックスの Next 参照）
- **bug-tracker の F-/B-番号**: 妻フィードバック ID
