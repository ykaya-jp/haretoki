Vercelにデプロイしてください。

手順:
1. npm run lint && npm test でエラーがないことを確認する
2. npm run build でビルドが通ることを確認する
3. 現在のブランチがmainかを確認する。mainでなければマージを促す
4. git statusで未コミットの変更がないことを確認する
5. vercel --prod でデプロイ（初回はvercel linkが必要）
6. デプロイ後のURLを表示する
