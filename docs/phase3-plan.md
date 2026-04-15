# Phase 3 統合実装計画（2026-04-14）

> 妻要望の原文（`docs/wife-requirements.md` §0 "カテゴリ&属する項目群のうちアプリ内で任意に設定したもので見やすくわかりやすく式場同士を横比較したい"）を最優先の北極星に据えたうえで、
> Phase 3 当初スコープ（ビジュアル刷新 "Atmospheric Layers v4.1"）・残留バグ・監査 G-01〜G-10 をまとめて消化する統合プラン。

## 北極星

**「項目を任意に選び、式場を横比較する」を、最高品質の UX で実現する。**

これは Phase 2 までに散らばっていた機能（見積もり / 評価 / 口コミ / 訪問チェック / プラン）を **一枚の比較ビュー** に統合する作業。Phase 3 の 70% をこれに投下する。

---

## ワークストリーム

### A. 横比較チェックリスト基盤（最優先・70%）

対象仕様: `docs/wife-requirements.md` §0（原文）＋ §1〜§6（6 カテゴリ）＋ §2〜§4（ソート / 口コミ / プラン透明化）

#### A-1. 項目ライブラリ（固定プリセット + 任意選択）

6 カテゴリ × 合計 ~90 項目のプリセットを `src/lib/checklist-presets.ts` で定義:
- CHAPEL: インテリア / ゲスト席 / 演出
- FACILITY: 導線 / 控室 / アメニティ / バリアフリー
- BANQUET: 収容人数・レイアウト / インテリア / 演出・音響
- DRESS_ITEM: 衣裳・ヘアメイク / アイテム
- STAFF_ESTIMATE: スタッフ / 見積り
- CUISINE_DRINK: 料理 / ドリンク・ケーキ

各項目: `{id, category, subcategory, question, type: "yesno"|"multi"|"memo"|"photo"|"number"}`

#### A-2. DB スキーマ拡張

- `ChecklistItemLibrary`（プリセット。DB or 定数いずれかで管理）
- `ProjectChecklist`: project × 選択された library_item_id[]（任意選択を保存）
- `VenueChecklistAnswer`: venue × item × status(checked/unchecked/unknown) + memo + photoUrls[]
- 既存 `VisitChecklistItem` は visit 固有のため残すが、新構造とブリッジ（見学中の入力が VenueChecklistAnswer にフィードする）

#### A-3. UI — 3 画面

1. **項目選択画面**（`/project/checklist`）: プロジェクト単位で使う項目をトグル。カテゴリ折りたたみ
2. **式場別入力画面**（`/venues/[id]/checklist`）: 選択済み項目を上から入力。チェック + メモ + 写真
3. **横比較ビュー**（`/candidates/compare`）: マトリクス、式場×項目。差分ハイライト、写真サムネ inline、行単位ソート

#### A-4. 既存資産の統合

- W-5 複合スコア → 総合☆ として比較ビューのヘッダーに
- 口コミ要約 → 項目「接客」「料理」にインライン表示
- ウォーターフォール → 項目「見積り」にインライン表示
- プラン内容 → 項目「プランに含まれるもの」にインライン表示

### B. ビジュアル刷新 "Atmospheric Layers v4.1"（15%）

`docs/myreview/ui-ux-remediation-plan.md` §2.3 の 5 本柱。以下のみ今フェーズ:
- `--gradient-dawn` / `--gradient-noon` / `--gradient-dusk` トークン追加
- frosted glass（BottomNav, Sheet, sticky ヘッダ）
- gold hairline（重要区切り）
- Typographic contrast 強化（数値ディスプレイ扱い）
- Halo Tap 演出（主要 CTA）

DESIGN.md v4.1 を書面更新。

### C. 残留バグ・ポリッシュ（10%）

監査 `docs/myreview/phase3-audit.md` + 動作で見つかったもの:
- G-01 `ReviewRatioBar` の二重描画（5 分で修正）
- G-04 ランディング「6 軸×AI」 vs TIER1_DIMENSIONS 5 次元 — どちらかに揃える
- E2E flaky `scenarios.spec.ts:213`（auth check Suspense タイミング）
- コーチ「週 1-2 回制限」ロジックが未実装 — 常時出ている状態を直す
- E-4 Toast 「タップで即消し」を Sonner で実装（duration 短縮はした）
- W-4 写真サムネ幅超過（`VENUE_COL_W` 拡大 or `maxShow=2`）

### D. 計測（5%）

Phase 1-2 の効果を Vercel Analytics / Web Vitals で数値化:
- LCP p75
- タブ切替時間 p75
- Server Action p95

---

## 実行計画（worktree 並列）

| worktree | スコープ | 主な変更対象 |
|---|---|---|
| `feat/phase3-checklist-core` | A-1〜A-4: DB + 3 画面 + 横比較統合 | prisma schema / server actions / `src/app/(app)/venues/[id]/checklist` / `src/app/(app)/candidates/compare` / `src/lib/checklist-presets.ts` |
| `feat/phase3-visual-v4-1` | B: Atmospheric Layers + DESIGN.md 更新 | `globals.css` / `tailwind.config.ts` / BottomNav / Sheet / DESIGN.md |
| `fix/phase3-bugs-audit` | C: G-01 / G-04 / flaky E2E / coach cadence / E-4 toast / W-4 幅 | 各ファイル局所修正 |
| `chore/phase3-measure` | D: Web Vitals スナップショット追加、レポート docs に残す | vercel analytics 設定確認 / docs/phase3-metrics.md 新設 |

A が最大。3 worktree で A-1 / A-2-3 / A-4 に分けるか検討（schema 変更が A の前提で先にマージ）。

---

## Ship Cycle

1. worktree ごとに実装（subagent + オーケストレーター commit）
2. E2E（Mobile Chrome + 認証付きスモーク）
3. 論理単位で develop merge
4. push → `vercel --prod`
5. **本番で主要動線を実機で叩く**（rating 保存 / 比較 / 式場追加 / 評価）← Phase 2 の反省
6. worktree + branch 削除

## Definition of Done

- ✅ 妻要望 §0 原文が本番で「任意項目選択→式場横比較」として体感できる
- ✅ `problems_01.md` の未解消 4 件が解消
- ✅ ランディング約束事 8 件が実装と一致
- ✅ DESIGN.md v4.1 として atmospheric layers が記述 + 主要画面に反映
- ✅ モバイル実機で LCP < 1.8s / タブ切替 < 500ms を実測確認

---

## 予防策（Phase 2 反省から採用）

- `~/.claude/rules/development-workflow.md` に追加済み「実装変更時にテスト同期」ルール準拠
- Prisma schema 変更を含む実装後は **dev server 起動 + authenticated Playwright スモーク**を必ず走らせる
- 本番デプロイ後は **実 URL で主要フローをクリック** — 200 OK チェックだけで終わらせない
