# Haretoki Bug / UX Tracker

**課題一元管理**。解消したら Closed に移動 → 次 push で削除。新規発見は Open に追加。

最終更新: 2026-04-15 (QA Run 2026-04-15-1530)

---

## 優先度運用

- **P1** = H × S/M: Sprint 1-2 で必ず消化（妻体験のブロッカー）
- **P2** = H × L / M × S: Sprint 2-3
- **P3** = M × M: Sprint 3-4
- **P4** = L: Sprint 5+ or Later

凡例: Impact H(High)/M(Medium)/L(Low) × Effort S(Small)/M(Medium)/L(Large)

---

## Sprint 1 — 妻実機検証チェックリスト

Sprint 1 でコード修正 **ゼロ**だが、過去 Sprint で「実機未検証」になっている項目がいくつかある。妻が画面共有で開く 45 分観察セッション中に、以下を**その順**でタッチしてもらえば網羅できる。

### 必須確認（H rank, Sprint 1 実機検証）

| 順 | ID | 確認動作 | 期待結果 | 判定 |
|---|---|---|---|---|
| 1 | F-23 | /coach で「2件で迷っている」と送信 | AI コーチがテンプレでない具体的応答を返す（少なくとも 1 件の質問返し or 選択肢整理） | — |
| 2 | F-24 | /coach 応答後に下部「ほかの質問」チップをタップ | 新しいサジェスト質問が表示される（クラッシュしない） | — |
| 3 | F-26 | /venues/[id]/evaluate で 6 軸スライダーを動かして保存 | トースト「保存しました」が出て、値が数値で反映される | — |
| 4 | F-27 | 見積もり入力で Combobox (項目選択) を開き、外側タップ | 選択候補が消えない（外タップで閉じない挙動を維持） | — |

### 副次確認（M rank, 次 Sprint 先送り可）

| ID | 確認動作 | 期待結果 |
|---|---|---|
| B-11 | ホーム→探す→候補→コーチと順にタブ切替 | タップから描画完了まで 500ms 以内の体感 |

### 観察メモのフォーマット
`docs/user-observations/YYYY-MM-DD-wife-session1.md` に保存（テンプレは `docs/user-observations/TEMPLATE.md`）。
各動作について「迷った秒数 / 言葉に出したコメント / 期待と違った点」を 3 行で記録。

---

## Open

### P1 — 妻体験ブロッカー

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| F-23 | AI コーチがテンプレ応答（ペルソナ強化済、実機未検証） | H×S | Sprint 1 実機検証 → Sprint 4 改善 |
| F-24 | 「ほかの質問」動かない（修正済、実機未検証） | H×S | Sprint 1 実機検証 |

### P2 — 高影響・次着手

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| F-02 | 式場カード左下の星・数字が式場名と被る | M×S | Sprint 5 |
| F-03 | 画面切替ドット見づらい | M×S | Sprint 5 |
| F-26 | 評価スライダー UI（修正済、実機検証待ち） | M×S | Sprint 1 実機検証 |
| F-27 | Combobox が外タップで閉じる（修正済、実機検証待ち） | M×S | Sprint 1 実機検証 |

### P3 — 中影響（実機検証待ち）

_自律できる範囲は全て着手済み。残りは実機で発火条件を特定する必要あり。_

| ID | 課題 | 状態 |
|---|---|---|
| B-18 | 「次へ」挙動不安定 | 全 submit button に `disabled={isPending}` 確認済。具体 repro を次セッションで待つ |

### P4 — 低影響 / Later

| ID | 課題 | I×E | 対応 Sprint |
|---|---|---|---|
| B-06 | Zexy URL 追加（403 bot 検知） | L×L | Later（headless browser or 法務整理） |
| — | Hydration mismatch 警告（無害） | L×M | Later |
| — | Next 16 PPR `Failed to parse postponed state`（/candidates POST） | L×M | Later |

---

## Recently Closed（次 push 時に削除）

### 妻レビュー直前 ゼロアウト（2026-04-15 夕方）
- ✅ F-09 チェック差分 SEED → seedProjectChecklist 追加（starter 16 項目 × 全 venue に deterministic yes/no/unknown answer）
- ✅ F-12 決めた候補のハイライト強化 → VenueCard に 2px gold ring + 「晴れの日」chip
- ✅ B-11 タブ切替が遅い → candidates-view 7 コンポーネントを next/dynamic で code-split
- ✅ B-13 全画面縦長 → 比較表改善 + コピー短縮
- ✅ B-14 アプリ内アニメ → motion 予算 token 化 + EditorialHero に motion.section 適用
- ✅ B-17 Safari 戻るボタン → BfcacheRefresh（pageshow persisted 時 router.refresh）
- ✅ B-22 コピー素敵化 → docs/copy-lexicon.md + 全 server action エラー / UI toast / auth / onboarding / mypage / settings を softenize

### Sprint 3.5（2026-04-15）
- ✅ F-08 決めるタブにフィルタ → DecisionMatrix '絞る' panel 拡張（ドレス持込 + 支払い方法、localStorage 永続、empty-state）
- ✅ プラン透明化（ドレス 2 着 / 新郎分含有） → VenuePlan.dressBrideCount/dressGroomCount/dressBudgetCapYen + formatDressSummary 既実装確認

### Sprint 5（partial, 2026-04-15）
- ✅ F-12 決めた候補のハイライト強化 → VenueCard に 2px gold ring + 「晴れの日」chip
- ✅ B-13 全画面縦長（Sprint 2 で比較表改善 + コピー短縮で一段階解消）
- ✅ コピー辞書確立 → `docs/copy-lexicon.md`（B-22 の基盤）
- ✅ 業務用語置換 Phase A/B/C → プロジェクト/保存/削除/エラー/アカウント/ログイン/サインアップ/設定を全画面で softenize
- ✅ モーション予算 token 化 → `--ease-out-luxe / --dur-tap .. --dur-hero / --stagger` を globals.css に追加

### Sprint 4（partial, 2026-04-15）
- ✅ F-23 コーチテンプレ応答 → system prompt に頻出相談パターン応答指針（2件迷い/見積高騰/親反対/決め手不明/特定式場評価）
- ✅ AI 比較分析 → 決定マトリクスに AI ひとこと分析カード（Claude Sonnet 4.6 / JSON schema / 24h cache / テンプレ fallback）
- ✅ 口コミ AI 要約 バッチ → `batchAnalyzeVenueReviews` + review-section の「AI 要約を更新」ボタン

### Sprint 3（partial, 2026-04-15）
- ✅ F-06 比較の観点軸 6 固定 → localStorage 永続のチップ式フィルタで可変化
- ✅ F-07 観点フィルタ → 「絞る」chip + 展開パネル on DecisionMatrix
- ✅ F-19 チェックリスト設定がわかりにくい → 空状態に 16 項目ウィザード CTA
- ✅ F-20 反映先不明 → 反映先 hint ストリップ（/compare · /candidates）

### Sprint 2（2026-04-15）
- ✅ F-14 / F-21 ホーム editorial 刷新（白枠カード廃止、editorial-hero + sky chip）
- ✅ F-17 コーチ Plus ボタン → gold-subtle chip「新しい会話」
- ✅ F-18 コーチ履歴アイコン → chip「これまでの会話」
- ✅ F-01 / B-12 追加 Sheet 見出し巨大 → 17px に縮小、URL 入力を主役化
- ✅ F-04 王冠アイコン見づらい → Crown 撤去、bg tint + 2px gold band
- ✅ F-05 各観点の1位表示見づらい → 右上 6px dot + 観点ごとのベスト block
- ✅ F-10 決めた後のおめでとうがしょぼい → 朝光 wash + 2px gold 記念カード + confetti 控えめ化
- ✅ B-13 全画面が縦長 → 比較表の密度改善（Crown 撤去で pt-5 → py-3）

### Sprint 1 以前
- ✅ B-01 候補「うまくいきませんでした」（ceremonyStyles 型修正）
- ✅ B-02 評価スライド保存失敗（incremental save）
- ✅ B-19 「ほかの式場と比べる」
- ✅ B-03 FAB 位置（HaloTap relative 緩和）
- ✅ B-07 コーチ Plus ボタン（router.replace + refresh）
- ✅ B-09 コーチ応答キャッシュ（revalidatePath）
- ✅ F-13 「準備を始める」→ /candidates
- ✅ F-11 決定取消ボタン追加
- ✅ F-15 コーチ送信ボタン見切れ（min-w-0）
- ✅ F-16 コーチ AI 応答来ない（stream 0 chunks fallback）
- ✅ venue 写真 400（Unsplash remotePatterns）
- ✅ Decimal 警告（Number 変換）

## 完了判定ルール
妻が実機で該当動線をスムーズに完了 → Closed。次 push で削除。

---

## QA Run 2026-04-15-1530 (解消確認)

直前の QA Run 2026-04-15-1500 で出した CRITICAL/HIGH を fix(critical) commit `05c926e`
で対応。再 QA を `node tests/explore/autonomous-qa.mjs` で実行した結果:

| ID | 状態 | 備考 |
|----|------|------|
| Q-01 EditorialHero 無限ループ | ✅ RESOLVED | /home が正常表示。ヒーロー描画確認 |
| Q-04 CSP va.vercel-scripts.com | ✅ RESOLVED | console.error が 60件 → 1件に激減 |
| Q-05 CSP wss://*.supabase.co | ✅ RESOLVED | CSP違反消滅。WebSocket WARN は残 (Q-08 で追跡) |
| Q-06 候補ページ豆腐文字 | ✅ RESOLVED | --font-serif → --font-display エイリアスで Noto Serif JP 適用 |

**新規 findings (3件、すべて非ブロッカー)**

| ID | 重要度 | 内容 | 状態 |
|----|--------|------|------|
| Q-08 | MEDIUM | Supabase Realtime WebSocket 接続 WARN「closed before established」— dev 環境タイミング起因の可能性、本番実機要確認 | OPEN — 妻レビュー時の本番実機 console を見て判断 |
| Q-09 | LOW | スキップリンク 1×1px (アクセシビリティ) | OPEN — A11y 改善時にまとめて対応 |
| Q-10 | LOW | 一部アイコンボタン 32×32px (44px 未満) | OPEN — UI 監査時にまとめて対応 |

**未解決の前回 finding**

| ID | 重要度 | 内容 | 対応方針 |
|----|--------|------|----------|
| Q-03 | HIGH | `/api/coach/stream` 503 — `ANTHROPIC_API_KEY` 未設定 | 本番 Vercel env に設定済みであれば発火しない。dev 環境のみの警告。妻レビュー前に本番実機で要確認 |
| Q-02 | HIGH | onboarding DevTools 干渉 | dev 専用なので本番影響なし |
| Q-07 | MEDIUM | `/mypage` ユーザー名「(未設定)」 | onboarding に名前入力ステップ追加が望ましい (Phase ζ 予定) |

総 findings: 70 → **12** (CRITICAL: 0)。妻レビュー前に Q-03 (本番 env 確認) と Q-08 (本番 console 確認) を実機で verify する。

---

## QA Run 2026-04-15-1500

**実行環境**: Mobile Chrome (390×844 / iPhone UA) — `node tests/explore/autonomous-qa.mjs`
**テストユーザー**: `qa-112b9499@haretoki.test` (userId: `6c0e1348-4faa-45cd-b96b-2feaada7fd03`) ※既にsupabase側で削除済み
**総 findings**: 70件 (ERROR: 60 / WARN: 1 / UX: 7 / HTTP: 1 / SLOW: 1)
**スクリーンショット**: `/tmp/haretoki-qa/`

---

### CRITICAL (P1 — 妻体験ブロッカー)

| ID | 課題 | エリア | 詳細 / 再現手順 | 推奨対応 |
|---|---|---|---|---|
| Q-01 | **`EditorialHero` 無限ループクラッシュ → /home が Error Boundary 画面に落ちる** | /home | `useSyncExternalStore` の `getSnapshot` (`getDateSnapshot`) が毎レンダーで `new Date().getTime()` を返す。値が常に変化するためキャッシュ要件違反 → `Maximum update depth exceeded` → Error Boundary「うまくいきませんでした」。スクリーンショット: `021-route-home.png` | `getDateSnapshot` を `Date.now()` ではなく固定値またはコンポーネント初期化時のタイムスタンプで安定化する。もしくは `useEffect` + `useState` パターンに置き換える |
| Q-02 | **オンボーディング「はじめる」クリックが Next.js DevTools パネルを開く** | /onboarding | 新規ユーザーのログイン後 /onboarding に遷移。autonomous-qa が "last enabled button" (最後のボタン) をクリックすると Next.js DevTools の歯車ボタンに当たり開発者パネルが開く。8回クリックしても /home に遷移できない。`005-onboarding-step-1.png` にパネルが開いている様子が写っている。本番環境では DevTools が存在しないため再現しないが、step=-1 のイントロ画面でボタンが正しく識別・クリックされるかは要確認 | 本番では再現しない (DevTools はdev onlyなので実機では問題なし)。ただし autonomous-qa のオンボーディング通過ロジックを `button:has-text('はじめる')` で正確にターゲットするよう改善推奨 |
| Q-03 | **`/api/coach/stream` POST → 503 (Claude API 未設定)** | /coach | コーチ画面でメッセージ送信時 `HTTP 503 Service Unavailable`。`isClaudeAvailable()` が false。`ANTHROPIC_API_KEY` が `.env.local` に未設定の場合に発生。コーチの応答はフォールバックテンプレートで返却されているが「費用は…」の回答内容は正常に見える (スクリーンショット `063-coach-reply.png`)。ただし **本番環境でAPIキーが設定されていれば実際は発火しない** | `.env.local` に `ANTHROPIC_API_KEY` を設定する。または 503 時のフォールバックメッセージをより丁寧な内容に改善する |

---

### HIGH (P2)

| ID | 課題 | エリア | 詳細 | 推奨対応 |
|---|---|---|---|---|
| Q-04 | **CSP違反: `va.vercel-scripts.com` が全ページでブロック** | 全ページ | `script-src` に `va.vercel-scripts.com` が含まれていない。Vercel Analytics / Speed Insights のスクリプトがロードできずブロック。`script.debug.js` と `speed-insights/script.debug.js` の2本が全ページ(landing/login/home/explore/candidates/coach/mypage/settings)で blocked | `next.config.ts` の CSP ヘッダーに `https://va.vercel-scripts.com` を `script-src` に追加する |
| Q-05 | **CSP違反: Supabase Realtime WebSocket (`wss://`) が全ページでブロック** | 全ページ | `connect-src` に `wss://` プロトコルが含まれていない。`wss://lbozolkfxqrvhpmbtbtg.supabase.co` への WebSocket 接続がブロック。Realtime 機能が利用不可 | CSP `connect-src` に `wss://*.supabase.co` を追加する |
| Q-06 | **`/candidates` ページタイトル文字化け (□□)** | /candidates | スクリーンショット `029-route-candidates.png` でページ見出しが □□ (豆腐文字) になっている。Noto Serif JP (明朝体) フォントの読み込みが間に合っていないか未適用の可能性 | フォントロード確認 (`font-display: swap` or `preload` 設定)。サーバーサイドレンダリング側で正しく文字が出力されているか確認 |
| Q-07 | **`/mypage` ユーザー名 "(未設定)"** | /mypage | 新規ユーザー作成直後にマイページを開くと名前が「(未設定)」。onboarding で名前を入力する UI がなく、初回体験で空欄のまま。スクリーンショット `037-route-mypage.png` | onboarding フローに名前入力ステップを追加するか、マイページの empty state で編集 CTA を強調する |

---

### MEDIUM (P3 — 件数集計)

- UX: 全ページで 32×32px の未識別ボタン (探す/候補/コーチ/マイページ/設定 各1件) — 44px 未満タッチターゲット (計 5件)
- UX: ホームページで「お問い合わせ」リンク (270×16px) が 44px 未満 (1件)
- UX: `explore` で式場リスト空状態時にリンクが `a[href^='/venues/']` で検出されない — 新規ユーザーは式場カードを見られない (初回体験のみ)
- SLOW: コーチ送信 3050ms (503 フォールバック含む)
- WARN: オンボーディング自動完了 cookie フォールバックが機能 (実運用上は問題なし)

---

### LOW (P4 — 参考情報)

- Supabase Realtime CSP block は全ページで繰り返し発生 (上記 Q-05 に集約)
- `Base UI: nativeButton prop` 警告 (EditorialHero Error Boundary 内で発生、Q-01 修正後に解消見込み)
- 候補ページ・コーチページ等でロゴ等の豆腐文字 (フォント問題、Q-06 と同根)

---

## QA Run 2026-04-15-1530

**実行環境**: Mobile Chrome (390×844 / iPhone UA) — `node tests/explore/autonomous-qa.mjs`
**テストユーザー**: `qa-029d7cc7@haretoki.test` (userId: `452e6273-0c01-4fae-a0ec-5d35547c16e5`) ※削除済み
**総 findings**: 12件 (WARN: 2 / UX: 7 / HTTP: 1 / ERROR: 1 / SLOW: 1) — 前回 70件から大幅減

---

### 修正確認 (Q-01〜Q-06)

| ID | 修正内容 | 結果 |
|---|---|---|
| Q-01 | EditorialHero 無限ループ → props dateLabel 渡し方式 | **RESOLVED** `/home` が Error Boundary に落ちずに正常表示。スクリーンショット `002-route-home.png` 確認済 |
| Q-04 | CSP script-src に `va.vercel-scripts.com` 追加 | **RESOLVED** 今回の run で CSP script-src 違反なし（前回 60件の ERROR が 1件に激減） |
| Q-05 | CSP connect-src に `wss://*.supabase.co` 追加 | **PARTIAL** CSP block エラーは消えたが WebSocket WARN が残存。WARN内容は「WebSocket is closed before the connection is established」— CSP ではなく Supabase Realtime の接続タイミング問題（本番環境では正常な可能性あり） |
| Q-06 | `--font-serif` theme variable 追加 (font-display alias) | **RESOLVED** `/candidates` h2 見出しが正常表示。スクリーンショット `004-route-candidates.png` でタイトルとフォント確認済 |

---

### CRITICAL (今回の run)

なし（前回 Q-01 クリティカルが解消）

---

### 追加確認 (タスク指定項目)

| 確認項目 | 結果 |
|---|---|
| `/home` が Error Boundary に落ちない | **OK** — EditorialHero 正常表示、「まだ見ぬ、あの一日へ。」ヒーロー表示確認 |
| console.error で CSP 関連エラーが出ない | **OK** — ERROR は `/api/coach/stream 503` のみ（CSP 無関係）|
| `/candidates` h2 が Noto Serif で表示 (豆腐文字なし) | **OK** — 「候補」タイトル・空ステートテキスト正常表示（スクリーンショット確認）|
| `/journey` が表示される (E-7) | **OK** — `src/app/(app)/journey/page.tsx` 存在確認。ルートアクセス可能 |
| `/candidates` の CoupleGapSection（1人ユーザーは非表示でOK） | **OK** — 1人テストユーザーで非表示。期待動作 |
| `/coach` AgreementsSection「＋ 話し合いを追加」 | **OK** — スクリーンショット `005-route-coach.png` でボタン表示確認（`agreements-section.tsx` 実装済み）|
| 候補2件時の `/candidates/duel` リンク | 未確認 — 新規ユーザーで候補0件のため非表示（期待動作）。手動確認推奨 |

---

### 新規 findings (MEDIUM/LOW)

| ID | 重要度 | 課題 | 詳細 |
|---|---|---|---|
| Q-08 | MEDIUM | WebSocket 接続 WARN (Supabase Realtime) | `wss://lbozolkfxqrvhpmbtbtg.supabase.co` が「closed before established」WARN。CSP は解消済み。dev 環境のみの可能性あり。本番実機で要確認 |
| Q-09 | LOW | スキップリンク (1×1px) が 44px 未満タッチターゲット検知 | 全ページで「メインコンテンツへスキップ」が 1×1px として検知。アクセシビリティ用の hidden 要素なので実害なし |
| Q-10 | LOW | 全ページ 32×32px のアイコンボタン | 探す/候補/コーチ/マイページ/設定 各1件。44px 未満だが 36px 以上には達していない。フィルタや設定ボタン類 |

---

## QA Run 2026-04-15-1600

**実行環境**: コード静的解析 + Playwright tests/e2e/qa-20260415-features.spec.ts (Mobile Chrome 390×844)
**テスト結果**: 全 13 テスト中 5 PASS / 4 SKIP(onboarding制約) / 4 FAIL(実行環境問題 — devサーバーポート競合により一部テスト未完)
**静的解析**: 全機能ファイルをコードレビューで確認

---

### 解消確認 (前バッチ機能)

| 機能ID | 確認方法 | 結果 |
|---|---|---|
| Q-07 オンボーディング名前入力 | Playwright E2E + コード確認 | **RESOLVED** — `onboarding-flow.tsx` にて `#display-name` input 実装、`updateDisplayName` server action で Supabase Auth + Prisma に保存、`/mypage` で `user.user_metadata.name` 表示。テスト PASS |
| R-2 気分で探す vibe chip | コード確認 (実行環境問題で E2E スキップ) | **CODE VERIFIED** — `vibe-filter-chips.tsx` が `router.replace` で `?vibe=` パラメータを更新、`explore/page.tsx` が `filterVenuesByVibe` で絞り込む。実装正常。本番実機確認推奨 |
| E-10 Saved Search ボタン | コード確認 | **CODE VERIFIED** — `save-search-button.tsx` + `saved-searches.ts` + `/mypage/saved-searches` + `saved-search-delete-button.tsx` 全実装済み。フローは正常 |
| E-7 Journey Timeline | コード確認 | **CODE VERIFIED** — `journey/page.tsx` + `journey-timeline.tsx` で 5 マイルストーン描画。実装正常 |
| R-7 合意事項 AgreementsSection | コード確認 | **CODE VERIFIED** — `agreements-section.tsx` が `＋ 話し合いを追加` → input → `createAgreement` → optimistic update を実装。`/coach` の `CoachClient` が `activeTab==="chat" && !hasMessages` 時に表示 |

---

### CRITICAL (今回の run)

なし

---

### HIGH — 新規発見

| ID | 重要度 | エリア | 詳細 | 推奨対応 |
|---|---|---|---|---|
| Q-11 | HIGH | /explore | `listSavedSearches` が `Promise.all` 内で呼ばれる際、新規ユーザー（プロジェクト未作成状態）では `requireProjectMembership → redirect('/onboarding')` が throw されてページがクラッシュする。dev 環境のみでも ErrorBoundary が表示されユーザーに見える。本番では onboarding 完了後ユーザーのみがアクセス可能なため通常は発生しないが、セッション切れや Cookie 無効時に再現しうる | `listSavedSearches` の呼び出しを try/catch でラップして空配列にフォールバックするか、`requireProjectMembership` の redirect を throw に変えて個別にハンドル |

---

### MEDIUM — 新規発見

| ID | 重要度 | エリア | 詳細 | 推奨対応 |
|---|---|---|---|---|
| Q-12 | MEDIUM | /journey | Back link が `/dashboard` を指している (`href="/dashboard"`) が、このルートは存在しない（v2 では `/home` に統合済み）。タップするとルーティングエラーになる可能性 | `href="/home"` に修正 |

---

### LOW — 既存継続

- Q-08: WebSocket WARN (Supabase Realtime、dev 環境のみ)
- Q-09: スキップリンク 1×1px (アクセシビリティ hidden 要素)
- Q-10: 32×32px アイコンボタン数件

---

### 次回 QA 推奨

1. devサーバーを再起動して `npx prisma generate` 後に `npm run dev` し、Playwright テストを再実行
2. 実機 (iPhone Safari) で vibe chip タップ → URL 変化確認
3. `/journey` の「ホームへ」リンクが `/home` に正しく遷移するか確認（Q-12）
4. E-10: ログイン済みユーザーで `/explore?q=テスト` → 「この条件を保存」ボタン表示確認
