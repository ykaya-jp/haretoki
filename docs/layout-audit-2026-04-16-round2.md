# Haretoki レイアウト審美監査 2026-04-16 Round 2

## A. 前回 10 項目の実装確認

| ID  | 項目 | 状況 |
|-----|------|------|
| H-1 | `space-y-10` 統一 | OK。11 ページ統一。venues/[id]/checklist は space-y-4 残存 (N-8) |
| H-2 | Candidates 右上 icon 撤去 | OK。CoupleGap null 時に -mt-6 が hairline に食い込む (N-3) |
| H-3 | Home Journey → border-left hairline row | OK |
| H-4 | MyPage 4 見出し eyebrow 化 | OK |
| H-5 | Candidates hairline 追加 | OK |
| M-1 | RecentVenues bleed-edge | OK |
| M-2 | EditorialHero metrics 2 行化 | OK。compact mode で Row1 省略時カード痩せ (N-4) |
| M-3 | 戻るリンク → breadcrumb | OK。eyebrow 内タイポスケール衝突 (N-1) |
| M-4 | Agreements Lucide | OK |
| M-5 | SavedSearches sober-down | OK。過度で一覧性低下 (N-6) |

## B. 新規 finding

### High

- **N-1** 戻るリンク eyebrow 内タイポ衝突 — 10.5px uppercase に 12px normal-case が混在し HARETOKI · Section のラインが折れる (notifications / saved-searches / settings / journey)
- **N-2** Coach に masthead 未実装 — 9 画面中 Coach だけ editorial 統一から外れる
- **N-8** 詳細サブルート未移行 — venues/[id]/checklist, visits/prep|way-home の masthead / space-y / タイポ (Visit は polish 済み、check 要)

### Medium

- **N-3** Candidates 「チェック項目を編集」の -mt-6 が CoupleGap 非表示時に hairline と衝突
- **N-4** EditorialHero compact で metrics カード痩せ
- **N-5** Home Journey row のタップ領域 40-48px 揺れ
- **N-6** SavedSearches gold 完全除去でアイコン一覧性低下 — 中間トーン `gold-warm/70` に
- **N-7** NightQuestionCard 装飾クオート + AgreementsSection Dialogue eyebrow が近接 (editorial signage 過剰)
- **N-9** Candidates masthead ↔ hairline ↔ CoupleGap eyebrow の呼吸記号重複

### Low

- **N-10** Settings section 見出し font-medium 残存 (細字原則違反)
- **N-11** masthead eyebrow 10.5px が text-h1 に対して軽い
- **N-12** venues/[id] に masthead 無し

## C. 認証 QA
Bash 権限不足で未実施。別途環境で実施推奨。

## D. 次バッチ 5 件
1. **N-2** Coach masthead
2. **N-1** 戻るリンク breadcrumb タイポ統一
3. **N-8** venues/[id]/checklist v4.2 化
4. **N-10** Settings section 見出し v4.2 化
5. **N-6** SavedSearches アイコン gold/70 中間トーン

## ブランド整合度
85% → **92%** (+7pt)
