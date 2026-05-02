# Haretoki ヘルプセンター content

`/help` route が render する FAQ + トラブルシューティングの正本。
ファイルは markdown ですが、 `/help` page (`src/app/(app)/help/page.tsx`)
は markdown を直接読まず、 同じ vocabulary を **inline で TSX に持つ** —
content の正本を 2 ヶ所に分けてしまうと drift する。

## 編集ルール

1. 新しい FAQ row を増やしたい → `src/app/(app)/help/page.tsx` の
   `FAQ` 配列に追加 + 本ファイルにも 1 行追記 (検索性のため)。
2. 既存 row を更新 → `src/app/(app)/help/page.tsx` を編集 + ここの
   "current FAQ" 表を更新。
3. トラブルシューティングは `troubleshooting.md` (本 directory) を
   正本にし、 `/help` page には summary だけ表示する。 長文化させない。
4. 商用化前に「運営者情報」「正式な連絡先」 が出る場合、 ToS と
   Privacy の該当 section を直したついでに、 ここの `support@` プレースホルダーも
   現実の値に flip する。

## Current FAQ (順序は /help と一致)

1. アカウント / サインアップ
2. パートナー招待 ( /mypage/partner-invite )
3. 評価の入力 (own / partner)
4. 見積もり読み込み・編集
5. AI コーチの返事
6. 通知 (リマインダー / Push)
7. 退会・データダウンロード
8. セキュリティ・プライバシー
9. 複数端末で使ったとき
10. 困ったとき (お問い合わせ)

## 関連ドキュメント

- ユーザー向け正本 (route): `/help`
- お問い合わせ form: `/support`
- ToS: `/terms` / Privacy: `/privacy`
- Phase 3 統合検証: [`../phase3/integration-test-checklist.md`](../phase3/integration-test-checklist.md)
- A11y SR pass: [`../harness/a11y-sr-test-checklist.md`](../harness/a11y-sr-test-checklist.md)
