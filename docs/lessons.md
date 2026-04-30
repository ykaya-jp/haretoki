# Haretoki Lessons Learned

開発中に遭遇した問題と解決策の詳細記録。CLAUDE.md にはルール化された要点のみ記載し、ここに経緯と詳細を残す。

---

## 2026-04-13: 5-Agent Review から判明した問題群

### Mobile UX

**タッチターゲットが32px（h-8）だった**
- 状況: shadcn/ui のデフォルト Button が `h-8`(32px)、Input も `h-8`。全アプリのインタラクティブ要素が Apple HIG / WCAG の推奨44pxを下回っていた
- 影響: スマホでタップしにくい、特に星評価ボタンとフィルターチップ
- 解決: `button.tsx` と `input.tsx` の default サイズを `h-11`(44px) に変更。全チップ・セレクトにも `min-h-[44px]` を適用
- ルール: **プロジェクト初期に shadcn/ui のデフォルトサイズをモバイル基準(44px)に上書きする**

**iOS SafeArea 未対応**
- 状況: `mobile-bottom-nav.tsx` が `fixed bottom-0` だが `padding-bottom: env(safe-area-inset-bottom)` がなく、iPhone のホームインジケーター領域にナビが被った
- 解決: ボトムナビに `pb-safe`、レイアウトに `pb-[calc(4rem+env(safe-area-inset-bottom))]`
- ルール: **固定要素には SafeArea を必ず考慮する**

**ページ遷移が遅い（Server Component の往復）**
- 状況: 全ページが Server Component で、遷移ごとにサーバーラウンドトリップ。loading.tsx がなく白画面
- 解決: `app/(app)/loading.tsx` にスケルトンUI追加。フィルタ・検索はクライアントサイド処理に変更
- ルール: **新ページ作成時に loading.tsx も必須。フィルタ等の即時操作はクライアントで処理**

### セキュリティ

**認証ヘルパーのコピペによるセキュリティ穴**
- 状況: `requireUser()` / `requireProjectId()` が `venues.ts`, `ratings.ts`, `decisions.ts` に個別定義。`updateProjectStep` は認証なしで任意のprojectIdを書き換え可能だった
- 解決: 共通 `src/server/auth.ts` に統一予定（Phase 1.5）
- ルール: **認証ロジックは1ファイルに集約。Server Actionは必ず認証ヘルパーを呼ぶ**

### 環境設定

**Prisma が .env.local ではなく .env を優先読み込み**
- 状況: `prisma.config.ts` が `import "dotenv/config"` で `.env` を読む。`.env` にプレースホルダーの `localhost:5432` があり、`.env.local` の Supabase URL が無視された
- 解決: `prisma.config.ts` で `dotenv.config({ path: ".env.local" })` を先に読むように修正。`.env` からDB URLを削除
- ルール: **`.env` にDB URLのプレースホルダーを書かない**

### UXデザイン

**「口コミ」ラベルの意味不明**
- 状況: Tier 1 評価軸の「口コミ (reviews)」がユーザー視点で何を評価するのか曖昧。「自分が他人の口コミを評価するのか、自分の感想なのか」がわからない
- 解決: 「総合印象 (overall_impression)」に変更
- ルール: **ラベルはエンジニア用語でなくユーザーの行動に合わせる**

**エラーバウンダリの不在**
- 状況: `error.tsx` / `global-error.tsx` がなく、Server Action のエラーやDB接続エラーで白画面
- ルール: **プロジェクト初期に error.tsx を作成する**

---

## 2026-04-14: Haretoki UI/UX 全面刷新から判明した問題群

### デザインシステム

**カラーパレット変更だけではデザインは変わらない**
- 状況: Navy → Cream にCSS変数を変えたが、コンポーネントの形・余白・サイズがshadcn/uiデフォルトのまま。ユーザーから「古臭い」「モダンでも美しくもない」の評価
- 解決: globals.css にコンポーネントオーバーライド（ボタン letter-spacing + hover lift、input 角丸12px + focus ring、カード borderless + shadow、シート backdrop-blur）を追加
- ルール: **カラーだけでなく、spacing, border-radius, shadow, transition を全てカスタマイズしないとshadcn/uiのデフォルト感は消えない**

**アニメーション速度が早すぎた**
- 状況: 150-300ms のアニメーションを実装したが「動きが早すぎる」のフィードバック。ラグジュアリーブランドはもっと遅い
- 解決: 全アニメーションを 600-800ms に変更。spring の stiffness を 150-200 に下げた
- ルール: **ラグジュアリー = 遅い。Aesop ~600ms、Apple ~500ms。150msはチープに感じる**

### コピー/用語

**エンジニア用語がUIに混入**
- 状況: 「ランディングページへ」「リトライ」「登録に失敗しました」などのテキストが花嫁向けアプリに不適切
- 解決: 「ランディングページへ」→ ロゴクリックでトップに戻る（テキストリンク自体を削除）。「リトライ」→「もう一度」。「〜に失敗しました」→「〜できませんでした」
- ルール: **モダンなアプリではロゴ = ホーム。テキストリンクで「〇〇ページへ」は使わない。エラーメッセージは柔らかく**

### セキュリティ

**クロスプロジェクトデータアクセスが全Server Actionで未防止**
- 状況: ratings, favorites, visits, estimates, decisions の全Server Actionでvenue/visitのプロジェクト帰属チェックがなかった。理論上、他ユーザーの式場データにアクセス可能
- 解決: auth.ts に requireVenueAccess / requireVisitAccess ヘルパーを追加し、全データ操作関数で使用
- ルール: **全てのデータ操作で「このリソースはユーザーのプロジェクトに属するか」を検証する。RLS は補助的な安全装置であり、Server Actionレベルのチェックが必須**

### 画像/ビジュアル

**コード生成でロゴは作れない**
- 状況: SVGでロゴを手書きしようとしたが、ユーザーから「ダサそうだからCodexとかに作らせなよ」のフィードバック
- 解決: ChatGPT (DALL-E) でロゴ、ヒーロー画像、空ステートイラスト、認証ページパターン、OGP画像を生成
- ルール: **ロゴ・イラスト・パターンはAI画像生成ツール（DALL-E/Midjourney）に任せる。コードで作ろうとしない**

### マイグレーション/デプロイ

**`_prisma_migrations` の failed row が build を巻き込む (P3009)**
- 状況: W15 F1-F4 を develop に merge → push したら Vercel preview build が `Error: P3009`。`20260421132434_enable_realtime_pub` の row が failed 状態のまま残っており、それ以降の migration が deploy できない。`alter publication supabase_realtime add table ...` 系の SQL は publication が既に持っているテーブルを 2 度目に add すると error を吐く一方、Supabase 側のテーブルは実態として publication 入りしているケースが該当
- 解決: `vercel env pull --environment=preview .env.preview.tmp` → preview 用の prisma config (一時ファイル) → `npx prisma migrate resolve --config prisma.config.preview.ts --applied 20260421132434_enable_realtime_pub` で row を applied に書き換え。Production 環境も同様に確認。終わったら tmp と一時 config は削除。
- ルール: **`alter publication ... add table` は `IF NOT EXISTS` 相当の冪等性が無いので必ず `do $$ begin ... exception when ... end $$;` で wrap する。failed row は CI を止めるので、merge 前に `prisma migrate status` を全環境で確認**

**`Server Action ファイル内の "_helper" は公開エンドポイント**
- 状況: F3 で `src/server/actions/decision-todos.ts` (`"use server"` 付き) に `_seedDecisionTodosForProject` / `_resetDecisionTodosForProject` を内部ヘルパー扱いで export していたが、Next.js は `"use server"` モジュールの **全 export を RPC エンドポイントとして自動公開**する。アンダースコア prefix は名前のヒントで Next.js のルーティングには影響しない。`requireProjectMembership` ガード抜きで他テナントの decision_todos を任意に reset できる状態だった
- 解決: ヘルパー本体を `src/lib/decision-todos/seed.ts` (plain module、`"use server"` なし) に移し、Server Action 側は `requireUser` + `requireProjectMembership` を通したラッパーだけに整理
- ルール: **`"use server"` ファイル内の export は全部 public API として扱う。内部ヘルパーは plain module に分離する。`_` prefix を信用しない**

**Server Component 内で `cookies().set()` は Next.js 16 で必ず throw**
- 状況: F4 で `src/app/invite/[token]/(guest)/view/page.tsx` の Server Component 内で cookie の screenCount bump のために `cookieStore.set(...)` を呼んでいたが、Next.js 16 の readonly cookie adapter は phase !== 'action' で `ReadonlyRequestCookiesError` を必ず throw する。Level 1 guest 体験が完全に死んだ
- 解決: bump を `src/app/invite/[token]/(guest)/bump/route.ts` の POST Route Handler に切り出し、client component (`BumpOnMount`) が mount 時に 1 回 fetch する形に
- ルール: **Server Component は cookie を read のみ。set/delete は Server Action または Route Handler に切り出す**

---

## 2026-04-30: 並列セッション衝突 + /mypage SSR 事故

### Server / Client 境界

**`"use client"` + lucide-react icon prop で /mypage が壊れた**
- 状況: W19-1 mypage refactor の `src/components/mypage/settings-row.tsx` に `"use client"` が付いており、Server Component のページから `<SettingsRow icon={Sliders} />` のように lucide-react アイコン（function component）を prop で渡していた。Next.js 16 は **Server → Client 境界で関数を serialize できない**ので runtime に `Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"` を吐き、本番 /mypage が割れた状態で稼働。tsc / lint / vitest / build ALL GREEN だったので CI では検知できず
- 解決: `settings-row.tsx` には state / useEffect / event handler が一切なく、アニメーションは全部 CSS-only (`hover:` `active:` `group-hover:`) だったので **`"use client"` を削除して Server Component に戻した** (commit `22ed96d`)。再発防止コメントを component 冒頭に明記
- ルール: **`"use client"` は state / effect / event handler が必要なときだけ付ける。CSS だけで動くアニメーションのために付けるな。特に function component (lucide-react icon、shadcn/ui の polymorphic icon prop 系) を prop 経由で渡す前提のコンポーネントは、Server Component を維持しないと boundary error で死ぬ**
- ルール: **「lint / tsc / vitest / build pass = 完了」ではない**。SSR/Client boundary error、auth redirect 不整合、prod-only DB state 等は build を貫通して runtime で初めて顕在化する。**deploy 前に dev server か `npm run start` で該当ページを実機ブラウザ（375px）で開いて確認**。CLAUDE.md の「動的スモーク必須ルール」を再確認

### 並列開発: 衝突と救出

**orphan commit を git reflog から救出した**
- 状況: 2 つの Claude セッションが同じ `develop` ブランチで同じタスク (W19-1 mypage refactor) を別アプローチで実装。pane 0:0.1 が `develop` に直接 `61918b0 feat(mypage): unify the More section into a single SettingsRow list` を commit した直後、pane 0:0.0 が `wt-w19-mypage` worktree 経由の subagent 実装を `merge: W19-1` として develop に重ね、`61918b0` の branch reference が失われた（commit object 自体は git の object DB に残っているが、どの ref からも到達できない orphan 状態）
- 解決: `git reflog` で orphan 化した SHA `61918b0` を発見 → `git branch feat/w19-1-pane01-recovered 61918b0` で復活 → `git show 61918b0` で diff 確認 → 後で「good-of-both refactor」 (commit `256839a`) として detail JSDoc + dual hover/active feedback + chevron `/60` だけを develop に上乗せ
- ルール: **並列セッションが衝突して片方の commit が orphan 化したら `git reflog --date=iso` で SHA を回収し、即座に `git branch <recover> <SHA>` で永続化する**。git の auto-GC は通常 30 日後だが、安全のため発見即 branch 化
- ルール: **並列セッションには「develop に直接 commit するな、feature branch に commit して push まで、merge は中央が引き受ける」を最初に通知**。直接 develop commit は orphan 化リスクが高い

**「両方を捨てない」マージ戦略**
- 状況: 上記の衝突で 2 つの実装が両方とも価値を持っていたケース。pane 0:0.0 版は野心的（Account/Partner セクション再構築 + a11y 強化）、pane 0:0.1 版は保守的（コメント JSDoc 詳細 + dual hover/active feedback）
- 解決: scope の広い方 (0:0.0 版 = wt-w19-mypage) を base にして develop merge 済の状態から、orphan 救出した 0:0.1 版 (recovery branch) の **「真に上乗せの価値がある差分」だけを cherry-pick 的に手動取り込み**。stylistic / equivalent な差分（grid vs flex、stroke 1.6 vs 1.75 など）はゼロ取り込み (pure churn 回避)
- ルール: **両者の良いとこ取りは「同等または好みの差は維持、明確な改善のみ取り込み」。layout 構造変更は churn になりがちなので避ける。docs JSDoc / interaction state / a11y 改善は取り込み価値が高い**

### tmux 並列開発の運用

**`tmux send-keys ... Enter` が submit しない（Claude Code TUI）**
- 状況: 別ペインの Claude セッションに指示を送るために `tmux send-keys -t 0:0.X 'message' Enter` したが、相手 TUI の入力プロンプトに**メッセージが貼り付くだけで Enter が submit に解釈されないケースがある**。auto mode でも処理が始まらない
- 解決: send-keys の直後に `tmux capture-pane -t 0:0.X -p | tail -5` で `Running…` / `Kneading…` / `Burrowing…` 等の処理サインを確認。サインが無ければ submit 失敗。対応:
  1. 空 Enter を送る: `tmux send-keys -t 0:0.X '' Enter`
  2. `C-m` を試す: `tmux send-keys -t 0:0.X 'message' C-m`
  3. **ユーザーに「pane 0:0.X で Enter 押してください」と頼む**（最も確実）
- ルール: **tmux send-keys ... Enter は submit を保証しない。送信後は capture-pane で必ず動作確認**

**中央コーディネーター + worker 分担プロトコル**
- 状況: 並列で複数の Claude が動くと、各々が独立に develop へ merge / push / `vercel --prod` までやってしまい、勝手にマージや prod 反映が走る。衝突・rollback 困難・想定外 deploy のリスクが高い
- 解決: 「**worker pane は feature branch に commit / push までで停止、merge と deploy は中央のみが引き受ける**」プロトコルを最初に明示通知。今回は中央が tmux 外端末 → 後に tmux pane 0:0.2 に handoff
- ルール: **3+ 並列の場合、必ず中央コーディネーター 1 人を立てる**。中央は実装しない（coordination に集中）。worker には「branch push まで、merge/deploy 禁止」をテキストで明示
- ルール: **中央交代時は引継ぎ書を /tmp/<project>-central-handoff.md に書き、新中央には「最初に Read してから動け」と渡す**。直近の repo 状態 / 進行中タスク / プロトコル / 教訓 / Vercel project IDs を含める
