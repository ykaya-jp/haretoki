# Haretoki — 全不具合一覧（網羅的監査）

> 全画面・全操作・全カテゴリの網羅的チェック結果。
> 基準: `docs/interaction-map.md`（プロダクト提供価値から導出したあるべき設計）
> 調査日: 2026-04-16
> カテゴリ: 画面遷移 / フォーム・保存 / 認証・リダイレクト / レイアウト・表示 / エラーハンドリング・データ整合性 / AI機能・パフォーマンス

---

## サマリ

| 深刻度 | 件数 |
|--------|------|
| CRITICAL | 4 |
| HIGH | 8 |
| MEDIUM | 13 |
| LOW | 10 |
| **合計** | **35** |

---

## CRITICAL（操作不能・データ破損リスク）

### C1: FavoriteFilter が0件で消滅 → ユーザーがフィルタ状態から脱出不能

**カテゴリ**: 画面遷移
**報告元**: ユーザー直接報告 + コード確認

候補画面でFavoriteFilter「パートナー」or「おふたり」を選択 → 該当0件 → FavoriteFilterが消滅 → 「自分」に戻す手段がない。

**根本原因**: `src/components/candidates/candidates-view.tsx:192-194`
```tsx
{favorites.length > 0 && (
  <FavoriteFilter active={filter} onChange={setFilter} />
)}
```

**修正**: FavoriteFilterをフィルタ結果に関わらず常に表示する。

---

### C2: AnimatePresence mode="wait" がタブ切替を420msブロック

**カテゴリ**: 画面遷移
**報告元**: コード分析

候補画面のタブ切替で exit アニメーション中にタップが無視される。C1と複合すると完全操作不能。

**根本原因**: `src/components/candidates/candidates-view.tsx:183` — `mode="wait"` + 420ms duration + exiting要素にpointer-events:noneなし。

**修正**: mode削除 or `popLayout`、exit中にpointer-events:none追加、duration短縮。

---

### C3: makeDecision が非アトミック — Venue status と Decision が不整合になりうる

**カテゴリ**: データ整合性
**報告元**: コード分析

**根本原因**: `src/server/actions/decisions.ts:32-48`
```tsx
// 2つの別々のDB呼び出し（トランザクションなし）
await prisma.venue.update({ data: { status: "selected" } });
decision = await prisma.decision.upsert({ ... });
```
1つ目の成功後にクラッシュすると、venueは"selected"だがDecisionレコードがない状態になる。なお`cancelDecision`は正しくトランザクションを使用している。

**修正**: `prisma.$transaction()` で包む。

---

### C4: project未作成ユーザーが /settings にアクセスすると500エラー

**カテゴリ**: 認証・リダイレクト
**報告元**: コード分析

middleware のオンボーディングチェック除外リストに `/settings`, `/mypage` が含まれる。新規ユーザーがオンボーディング完了前に直接 `/settings` を開くと、project が存在せず500エラー。

**根本原因**: `src/middleware.ts:14-18` — 除外パスにオンボーディングガードなし + `src/app/(app)/settings/page.tsx` にprojectMembershipチェックなし。

**修正**: layout.tsxのガードで全(app)ルートをカバー、または各ページで`requireProjectMembership()`を呼ぶ。

---

## HIGH（主要機能の欠陥）

### H1: Coach → 候補（比較タブ）への直接遷移が不可能

**カテゴリ**: 画面遷移

コーチの「比べる」リンクが `/candidates` に遷移するが常に候補タブが開く。`?tab=matrix` パラメータ未実装。

**影響ファイル**:
- `src/components/candidates/candidates-view.tsx` (L74-79, L87)
- `src/app/(app)/candidates/page.tsx` (L17)
- `src/server/actions/insights.ts` (L39)
- `src/server/actions/coach.ts`（複数箇所）

---

### H2: Server Action のエラー返却パターンが不統一

**カテゴリ**: エラーハンドリング

| ファイル | パターン |
|---------|---------|
| `venues.ts` | `{ success: false, error: string }` |
| `ratings.ts:93` | `{ success: false }` — errorフィールドなし |
| `decisions.ts:49-58` | throw で例外を投げる |
| `estimates.ts:36` | `{ error: fieldErrors }` (Zod構造) |

クライアントがエラーを一貫して処理できない。

**修正**: 全Server Actionを `{ success: boolean, error?: string }` に統一。

---

### H3: review.aiSummary に非nullアサーション — null時クラッシュ

**カテゴリ**: データ整合性

`src/components/venues/review-section.tsx:316` — `body={review.aiSummary!}`。Prismaスキーマでは `aiSummary String?`（nullable）。古いレビューやAI解析失敗時にクラッシュ。

**修正**: `review.aiSummary ?? ""` に変更。

---

### H4: venue.costMin に非nullアサーション

**カテゴリ**: データ整合性

`src/components/venues/venue-card.tsx:37` — `venue.costMin!`。スキーマでは nullable。

**修正**: オプショナルチェーンに変更。

---

### H5: error.tsx が explore, candidates, home に個別で存在しない

**カテゴリ**: エラーハンドリング

`src/app/(app)/error.tsx` が全体をカバーするが、ルート個別のerror.tsxがないためデータ取得失敗時にページ全体がアンマウントされる。

**修正**: 主要ルート（explore, candidates, home）に個別error.tsxを追加。

---

### H6: middleware → onboarding-gate 間のリダイレクトループ可能性

**カテゴリ**: 認証・リダイレクト

`onboarding_completed` cookieとDB状態のレースコンディション。cookieが未セットだがconditionsが存在する場合、middleware→onboarding→middleware のループが発生しうる。

**根本原因**: `src/middleware.ts:20-24` + `src/components/onboarding/onboarding-gate.tsx:15-26`

**修正**: onboarding-gateでconditions存在時は即座にcookieをセットしてリダイレクト。

---

### H7: ログアウト時に onboarding_completed cookie がクリアされない

**カテゴリ**: 認証・リダイレクト

`src/server/actions/auth.ts:7-11` — `signOut()` のみ。別ユーザーが同じ端末でログインするとオンボーディングがスキップされる。

**修正**: ログアウト時にcookie削除を追加。

---

### H8: Sheet閉じるボタンが28px — タッチターゲット不足

**カテゴリ**: レイアウト・表示

`src/components/ui/button.tsx:31` — `icon-sm` が `size-7`（28px）。DESIGN.md P5の44px最低基準を大きく下回る。全Sheetの閉じるボタンに影響。

**修正**: `icon-sm` を `size-11`（44px）に変更、または `icon` サイズを使用。

---

## MEDIUM

### M1: SegmentedControl にタップフィードバックがない

**カテゴリ**: 画面遷移
`src/components/candidates/segmented-control.tsx:73` — `active:scale-*` なし。

---

### M2: 式場カードのメタデータ行にtruncateなし — 375pxではみ出し

**カテゴリ**: レイアウト・表示
`src/components/venues/venue-card.tsx:153-155` — location + capacity の結合テキストに `truncate` 未適用。長い住所でオーバーフロー。

---

### M3: 比較マトリクスのsticky列幅が375pxで窮屈

**カテゴリ**: レイアウト・表示
`src/components/comparison/decision-matrix.tsx:494` — `w-[100px]` 固定。375pxではデータ列が275pxしか残らない。

**修正**: `w-[80px] md:w-[100px]` に変更。

---

### M4: コーチのストリーム応答がDB保存に失敗しても完了扱い

**カテゴリ**: AI機能
`src/app/api/coach/stream/route.ts:224-247` — fire-and-forget の `.catch(() => {})`。ユーザーは応答を見るがリロードすると消えている。

**修正**: DB保存をawaitしてからストリーム終了、または再送キューを実装。

---

### M5: 招待メール送信失敗がサイレント

**カテゴリ**: 認証・パートナー
`src/server/actions/invitations.ts:82-114` — メール失敗時も `success: true` + `emailSent: false`。UIで「メールは届かなかった可能性があります。リンクを直接共有してください」の表示が必要。

---

### M6: セッション失効時のユーザー通知なし

**カテゴリ**: 認証
`src/lib/supabase/middleware.ts:28-44` — Supabaseセッション失効時、無言で `/login` にリダイレクト。入力中のデータが消える。

**修正**: toast通知「セッションが切れました。再度ログインしてください」を追加。

---

### M7: console.error が本番コードに13箇所残存

**カテゴリ**: エラーハンドリング
`venues.ts`（5箇所）, `estimates.ts`（1箇所）, `invitations.ts`（1箇所）, `projects.ts`（2箇所）, `visits.ts`（1箇所）, 他。

**修正**: 構造化ロギング（Sentry等）に置き換え。

---

### M8: project.conditions が JSON型でスキーマ検証なし

**カテゴリ**: データ整合性
`prisma/schema.prisma` — `conditions Json?`。Server Actionで任意JSONが保存可能。読み出し時にクラッシュの可能性。

**修正**: Zod スキーマで入出力を検証。

---

### M9: 招待受諾ページで無効トークン時のリダイレクトが3ホップ

**カテゴリ**: 認証・リダイレクト
`src/app/(app)/accept-invite/page.tsx:8-12` — null時 `/` → `/home` → onboardingチェック。

---

### M10: fire-and-forget の generateVisitChecklist がエラーをconsole.errorのみ

**カテゴリ**: エラーハンドリング
`src/server/actions/visits.ts:47` — `.catch(console.error)`。ユーザーに通知されず、チェックリスト未生成のまま。

---

### M11: 写真オーバーレイのrgba値がダークモード非対応

**カテゴリ**: レイアウト・表示
`venue-card.tsx:81`（`from-black/45`）, `recent-venues.tsx:71`（`from-black/60`）, `photo-carousel.tsx:111`。ハードコードのためダークモードで不適切な見た目になる。

---

### M12: 評価のdebounce(500ms)にin-flightガードなし

**カテゴリ**: データ整合性
`src/components/ratings/dimension-ratings.tsx:66` — 500ms debounceのみ。連打で複数のsaveRatings()が同時発火する可能性。

**修正**: inFlightRef パターン（heart-button.tsx参照）を追加。

---

### M13: Explore の getFitReasons() がPromise.allに含まれていない

**カテゴリ**: パフォーマンス
`src/app/(app)/explore/page.tsx:145` — 他のデータ取得とは別に逐次実行。50-100ms のロスト。

---

## LOW

### L1: 手動式場追加のエラー時にサーバーエラー詳細が表示されない

**カテゴリ**: フォーム
`src/components/explore/add-venue-sheet.tsx:252` — `result.success` チェック後、具体的なerrorを表示せず汎用toast。

---

### L2: 最近見た式場の画像sizes属性が不正確

**カテゴリ**: レイアウト・表示
`src/components/home/recent-venues.tsx:68` — `sizes="300px"`。実際はビューポート依存。

---

### L3: FABのz-indexがChatBarと競合する可能性

**カテゴリ**: レイアウト・表示
`src/components/explore/add-venue-fab.tsx:14` — `z-40`。ChatBar（z-50）とは別ページなので実害なしだが、将来的に注意。

---

### L4: onboarding-flow.tsx で q.options! の非nullアサーション

**カテゴリ**: データ整合性
`src/components/onboarding/onboarding-flow.tsx:134` — 質問構造変更時にクラッシュ。

---

### L5: comparison-board.tsx が孤立コード（未使用）

**カテゴリ**: コード品質
`src/components/comparison/comparison-board.tsx:3-6` — TODOコメント付き。バンドルサイズに影響。

---

### L6: revalidateTag に無効なオプション `{ expire: 0 }` を渡している

**カテゴリ**: パフォーマンス
`venues.ts:47,266,335,579`, `coach.ts:107,192,333` — Next.jsが無視するが、コードの意図と実際の動作が乖離。

---

### L7: コーチのレート制限がインメモリ — 水平スケーリングで無効

**カテゴリ**: AI機能
`src/app/api/coach/stream/route.ts:23-39` — sliding windowがプロセスメモリ。Pod増加時に制限が効かない。

---

### L8: 写真フォールバックにアクセシビリティ属性なし

**カテゴリ**: レイアウト・表示
`src/components/home/recent-venues.tsx:92-95` — 「写真はまだありません」テキストに `role="status"` なし。

---

### L9: DimensionRatings のトランザクション範囲が広すぎ

**カテゴリ**: データ整合性
`src/server/actions/ratings.ts:28-88` — 同一venueの全visit評価を読み込むため、パートナー同時評価でコンフリクト可能性。

---

### L10: 招待コールバックが`next`パラメータを無視

**カテゴリ**: 認証・リダイレクト
`src/app/(auth)/callback/route.ts:19-35` — 招待がある場合、`next`パラメータを無視して `/accept-invite` にリダイレクト。

---

## 画面遷移チェック PASS（問題なし）

| # | チェック項目 | 結果 |
|---|------------|------|
| G2 | SegmentedControl 5タブ間の相互遷移 | ✅ PASS |
| G3 | disabled セグメントのtoastフィードバック | ✅ PASS |
| G4 | BottomNav 5タブ間の相互遷移 | ✅ PASS |
| G5 | 式場詳細の戻りナビゲーション | ✅ PASS |
| G7 | ホーム「すべて→」の遷移先 | ✅ PASS |
| G8 | 空ステートのCTA | ✅ PASS |
| G9 | 式場追加Sheet のエラーフォールバック | ✅ PASS |
| G10 | コーチのセッション履歴 | ✅ PASS |
| G12 | 全ルートに loading.tsx | ✅ PASS |
| G13 | ActionBar と BottomNav の重なり | ✅ PASS |
| G14 | 決定セレモニー後のタブ切替 | ✅ PASS |

## その他 PASS

| カテゴリ | チェック項目 | 結果 |
|---------|------------|------|
| フォーム | 星評価保存（debounce + transaction） | ✅ PASS |
| フォーム | 見積もり追加（Zod + バージョン管理） | ✅ PASS |
| フォーム | チェックリスト保存（upsert + idempotent） | ✅ PASS |
| フォーム | Venue status 変更 | ✅ PASS |
| フォーム | オンボーディング保存 | ✅ PASS |
| AI | URL式場抽出（Claude）— エラーハンドリング堅牢 | ✅ PASS |
| AI | インサイト生成（テンプレートベース、cacheTag付き） | ✅ PASS |
| AI | AI推薦（graceful degradation） | ✅ PASS |
| パフォーマンス | N+1クエリ — 検出なし | ✅ PASS |
| パフォーマンス | バンドル最適化（dynamic import + optimizePackageImports） | ✅ PASS |
| パフォーマンス | Server Component適切使用 | ✅ PASS |
| パフォーマンス | キャッシュ戦略（"use cache" + React.cache + revalidateTag） | ✅ PASS |
| パフォーマンス | 主要ページの Promise.all 並列化 | ✅ PASS |

---

## 修正優先順位

| 順位 | Issue | 理由 |
|------|-------|------|
| 1 | **C1+C2** FavoriteFilter消滅 + AnimatePresenceブロック | ユーザー報告済み。同一ファイルで同時修正可能 |
| 2 | **C3** Decision非アトミック | データ不整合リスク。1行修正（$transaction追加） |
| 3 | **C4** /settings 500エラー | 新規ユーザーが踏む可能性。ガード追加 |
| 4 | **H1** Coach→比較タブ直接遷移 | 主要ユースケースの欠損 |
| 5 | **H3+H4** 非nullアサーション | null データでクラッシュ |
| 6 | **H2** エラー返却パターン不統一 | 全Server Action横断。計画的に対応 |
| 7 | **H5** 個別error.tsx追加 | ページ単位の回復性向上 |
| 8 | **H6+H7** 認証ループ + cookie問題 | エッジケースだが踏むと脱出困難 |
| 9 | **H8** Sheet閉じるボタン28px | 全Sheetに影響するタッチ問題 |
| 10 | **M1-M13** Medium全件 | バッチで対応可能 |

---

## 修正対象ファイル一覧（影響度順）

| ファイル | 関連Issue | 変更規模 |
|---------|-----------|---------|
| `src/components/candidates/candidates-view.tsx` | C1, C2, H1, M1 | 中 |
| `src/server/actions/decisions.ts` | C3 | 小 |
| `src/middleware.ts` | C4, H6 | 小 |
| `src/components/candidates/segmented-control.tsx` | M1 | 小 |
| `src/app/(app)/candidates/page.tsx` | H1 | 小 |
| `src/server/actions/insights.ts` | H1 | 小 |
| `src/server/actions/coach.ts` | H1 | 小 |
| `src/components/venues/review-section.tsx` | H3 | 小 |
| `src/components/venues/venue-card.tsx` | H4, M2 | 小 |
| `src/components/ui/button.tsx` | H8 | 小 |
| `src/server/actions/auth.ts` | H7 | 小 |
| `src/server/actions/ratings.ts` | H2, M12 | 中 |
| `src/server/actions/venues.ts` | H2, M7 | 中 |
| `src/app/api/coach/stream/route.ts` | M4, L7 | 中 |
| `src/app/(app)/explore/page.tsx` | M13 | 小 |
| `src/components/comparison/decision-matrix.tsx` | M3 | 小 |
| `src/server/actions/invitations.ts` | M5 | 小 |
| `src/lib/supabase/middleware.ts` | M6 | 小 |
| `src/components/onboarding/onboarding-gate.tsx` | H6 | 小 |
