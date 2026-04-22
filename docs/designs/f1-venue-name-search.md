# F1: 式場名で検索して追加 — 5層設計

**Status**: Design Draft
**Branch**: `docs/w15-designs`
**Last updated**: 2026-04-21
**Author**: Product Designer (Claude)
**Related**: `src/components/explore/add-venue-sheet.tsx`, `src/server/actions/venues.ts` (`addVenueFromUrl` / `confirmVenueFromUrl`)

---

## 背景

現状の式場追加は **URL 貼付** または **手動入力** の 2 経路のみ。
妻テスト（`docs/myreview/problems_02.md`）で判明した最大の離脱要因は「Google で式場名を検索 → 結果ページを開く → URL をコピー → アプリに戻る → 貼り付ける」という **3 ホップの煩雑さ**。
目指す体験は **「ぐらんぷりんせす」と 7 文字打った段階で候補がサジェストされ、タップするだけで既存パイプラインに乗る** こと。アプリから一度も離れない。

## 参考にした競合・先行事例

Refero MCP が当 worktree では接続不可のため、Mobbin / Baymard / Google Places Autocomplete の一次情報を読み、抽象パターンのみを転用しました。

1. **Mobbin — Search Bar UI Design patterns**（[source](https://mobbin.com/glossary/search-bar)）
   - Airbnb の「focus すると画面全体が検索 overlay に切り替わる」フル画面方式
   - プレースホルダー主体で label を持たない「silent input」
   - サジェストは 1 行に primary text + secondary text の 2 段構成
2. **Baymard — Autocomplete Suggestions 9 UX Best Practices**（[source](https://baymard.com/blog/autocomplete-design)）
   - モバイルでは **サジェスト 8 件超えると読む気が失せる**。上限 6-8 件
   - 入力文字とマッチした部分を **bold で強調**（「ぐらん」と打ったら「**ぐらん**ぷりんせす」）
   - カテゴリラベル（「式場名」「地名」）で混在サジェストを整理
3. **Google Places Autocomplete**（[source](https://dev.to/gaelsimon/implement-and-optimize-autocomplete-with-google-places-api-461h)）
   - 300ms debounce が標準推奨（コスト削減と応答性の balance）
   - session token でコスト圧縮（1 session = input→selection の一連流）

**Trade-off**: Refero の実画面スクショが取れなかったため、インタラクションの細部（微細な easing や shadow）は Haretoki の DESIGN.md v4.2 token に揃えて補完しました。実装着手前に Refero 接続が戻れば `wedding venue search` / `restaurant name autocomplete` を検索し、最終 polish 段階で反映します。

---

## 1. 基本設計

### Purpose
**「思い浮かんだ式場名を、アプリから離れずに 3 タップ以内で候補に加える」** ことが唯一のゴール。
既存の URL / 手動経路は削らず、**第 3 の入口** として並列に追加する。ユーザーが何も知らないときは URL、名前だけ知っているときは検索、情報が独自のときは手動 — 3 経路が無意識に棲み分ける。

### Scope（対象に含むもの）
- 式場名テキスト入力（1 文字以上で UI 反応、3 文字以上で検索発火）
- サジェスト表示（最大 8 件、primary source 優先 + fallback）
- タップ選択 → 既存 `confirmVenueFromUrl` パイプラインへ直接流す
- 0 件時の「URL 貼付」「手動入力」への救済導線
- 既に project に同一 venue がある場合の merge 表示（`confirmVenueFromUrl` の dedupe 結果をそのまま利用）

### Non-goals（対象外）
- ジャンル / エリアフィルタ（今回は名前検索のみ。フィルタ UI は Explore タブ側の責務）
- 式場の口コミ集計プレビュー（選択後に既存パイプラインが非同期処理）
- 地図からの選択（Places 選定時のみ候補だが、第一弾の MVP では見送り）
- AI 自然文検索（「銀座でチャペル、100 名」のような query 解釈は F1 では扱わない）

### Persona

| Persona | Context | Pain | この機能で満たすもの |
|---|---|---|---|
| **プロジェクト owner**（主に 20-30 代女性）| 雑誌・SNS・友人の話で式場名を知り、帰宅後にアプリを開く | Google 経由の 3 ホップが面倒で、記憶の新鮮さが薄れる前に置きたい | 名前だけで登録完了 → 後で詳細確認 |
| **招待されたパートナー**（ログイン済、情報編集権限あり）| 通勤中にふと「あの式場、候補に入れといて」と言われて追加 | スマホ片手、Google → コピーの 3 アクションが通勤 UI で苦しい | 片手親指のみで完結 |

### Success Metrics

| 指標 | 現状（URL/手動のみ）| 目標 | 計測方法 |
|---|---|---|---|
| 式場追加成功率（開始 → 完了）| ~ 60%（URL 経由の推定）| **85% 以上** | `venue_added` event の source 別 funnel |
| 初回追加までの時間（add Sheet open → venue 作成）| 中央値 45-60s | **中央値 15s 以下** | Sheet open 時刻と `venue_added` 差分 |
| 検索エラー率（0 件 / timeout / API 失敗）| — | **5% 以下** | `venue_search_failed` / `venue_search_zero` 合算 |
| Name 経由の追加比率 | 0% | **30% 以上**（3 ヶ月後）| `venue_added.source = "name_search"` |

### データフロー

```
[User] 式場名を入力
  ↓ 300ms debounce
[Client] searchVenuesByName(query) を Server Action として呼ぶ
  ↓
[Server] 3 段階で候補を集める（並行実行、早いもの順で返す）
  ├─ Tier 1: 既存 Venue DB (project 跨ぎ、公開可フラグ付きのみ)
  ├─ Tier 2: Google Places Autocomplete API (type=establishment, JP, session-token)
  └─ Tier 3: Claude API による「式場名→候補 URL」fallback (Tier1/2 が 0 件時のみ)
  ↓
[Server] 重複排除 + 信頼度スコア降順で上位 8 件を VenueSearchHit[] で返す
  ↓
[Client] サジェストリストに描画（primary name + location + source badge）
  ↓
[User] 1 件タップ
  ↓
[Client] hit.sourceUrl または hit.venueDatabaseId を confirmVenueFromUrl / copyExistingVenue に渡す
  ↓
[Server] 既存の URL 取込パイプライン（photo/review/summary）が非同期で完走
  ↓
[Client] success toast + venue 詳細画面へ遷移
```

---

## 2. 詳細設計

### 検索ソース選定（最重要判断）

3 候補を比較。採用は **Tier 化した複合ソース**。

| ソース | Pros | Cons | コスト | 採用判断 |
|---|---|---|---|---|
| **Google Places Autocomplete** | 網羅性高・更新が早い・establishment で式場に絞れる | 1 autocomplete session が $0.00283、さらに選択時の **Place Details call が $0.017/回**（website 取得用）。月 1 万 session + 詳細 3k 解決で **約 $79** | 従量課金 | **採用（Tier 2）** |
| **ゼクシィ / みんなのウェディング 等 scrape** | 式場固有情報が濃い | 利用規約的に名前検索 API の継続呼び出しはグレー。robots.txt で autocomplete endpoint は disallow が多い | 法務コスト高 | **不採用**（既存の URL 取込は公開 URL 1 個のみ = fair use の範囲だが、name query で連続 hit させるのは別軸） |
| **既存 Haretoki Venue DB（project 横断）** | 0 コスト・ブランドコントロール下・写真 / 要約済みで最速 UX | project 作成初期はデータ量が薄い・project 跨ぎ取得の RLS 設計が必要 | 0 | **採用（Tier 1）** |
| **Claude API（「式場名で検索して URL を返す」）** | Tier 1/2 が 0 件の fallback として有用 | 信頼性が低く hallucination リスク | per-call ~ $0.003 | **採用（Tier 3、fallback のみ）** |

#### 優先順序の根拠
- **Tier 1 先頭**: 既に project にある venue を重複登録しそうな場合、即座に「既に候補にあります」を見せて無駄な confirm 処理を止めたい
- **Tier 2 本命**: ユーザーが知らない式場を検索したとき、Places が最も正確に引ける
- **Tier 3 保険**: 「小さな結婚式 銀座」のような非 establishment タグの式場名で、Places では来ないケースを拾う

#### コストガード
- Places autocomplete に **月間 3,000 session の soft cap** を設ける（env: `PLACES_AUTOCOMPLETE_MONTHLY_CAP`）
- 上限超過時は Tier 1 + Tier 3 のみで運用（UI 側は「今日は広い検索が混雑しています」表示）
- Session token は **1 input focus → 1 select または 30 秒無入力で close**。Places 公式推奨どおり

#### rate limit
- 個人ユーザー単位で **1 分あたり 20 query**（env: `NAME_SEARCH_RATE_LIMIT_PER_MIN`）
- 超過時はクライアント側で「少しゆっくり入力してください」ヒント、401 ではなく soft deny

### Prisma schema 変更の有無

**変更なし**。既存の `Venue` / `VenueFavorite` / `Project` で完結する。
Tier 1 のクロスプロジェクト検索は `prisma.venue.findMany({ where: { isPublic: true, ... } })` を新規ヘルパー `searchPublicVenuesByName` として切り出す。
ただし **`Venue.isPublic` フラグは現在存在しない**ため、将来の Phase 2 で追加検討。F1 MVP では Tier 1 を skip し Tier 2 + Tier 3 のみで起動する。

**Trade-off**: MVP では Tier 1 を諦めることで「同一 project 内の重複登録」の即時防止は既存 `confirmVenueFromUrl` の dedupe matcher に任せる（= 登録後に merge 判定）。早期の「既に候補にあります」ブロックは Phase 2 の楽しみに残す。

### 新規 Server Action シグネチャ

```ts
// src/server/actions/venue-search.ts

export type VenueSearchSource = "places" | "claude" | "internal";

export interface VenueSearchHit {
  id: string;              // 表示用 stable key (source:externalId 合成)
  name: string;            // 式場の正式名
  location: string | null; // 住所1行（あれば）
  source: VenueSearchSource;
  sourceUrl: string | null;// Places: Google Maps の place page, Claude: 推定公式 URL, Internal: null
  placeId: string | null;  // Places API 専用。confirmVenueFromUrl に渡す前の二次フェッチ用
  existingVenueId: string | null; // Tier 1 のみ: そのまま候補に置ける場合
  confidence: "high" | "medium" | "low";
}

export async function searchVenuesByName(
  query: string,
  sessionToken: string, // Places session の再利用キー。クライアントで uuid を生成し focus→select で固定
): Promise<{
  hits: VenueSearchHit[];
  error?: string;
  throttled?: boolean;
}>;
```

**認可 (必須)**:
- server action 先頭で `const user = await requireUser()` → `const { projectId } = await requireProjectMembership(user.id)` を呼ぶ
- rate-limit カウンターは **projectId 単位**で加算（個人 abuse より projectId 単位で上限を守る方が自然）
- 非ログイン・未参加プロジェクトから呼ばれた場合は `requireUser` / `requireProjectMembership` が throw → boundary が catch

**Quota counter の保存先**:
- Supabase の新規 row ベーステーブル `api_usage_counter (project_id uuid, year_month text, places_autocomplete_count int, updated_at)` を採用（Upstash Redis は追加インフラ増加、Vercel 既存なし）
- 月切替: `year_month = YYYY-MM` で upsert。新月でリセット
- 上限: `PLACES_AUTOCOMPLETE_MONTHLY_CAP = 3000 session/月` (実数は初回 1 ヶ月計測後に再調整)

#### 選択後フロー

3 source で分岐。既存 `addVenueFromUrl(url)` → `confirmVenueFromUrl(extracted, url, options)` の **2 段呼び出し** を維持する（`confirmVenueFromUrl` は単一引数版を持たない）:

1. **source === "internal"**: `copyExistingVenueToProject(hit.existingVenueId)` 新規 server action（Phase 2 実装）。MVP では `hit.sourceUrl` を `addVenueFromUrl → confirmVenueFromUrl` の 2 段に通して迂回
2. **source === "places"**: Google **Place Details API** で `website` を解決 → 取れたらその URL を `addVenueFromUrl → confirmVenueFromUrl` の 2 段に流す。website が無ければ Google Maps の `maps.google.com/?cid=…` URL を使う（`guardExternalUrl` の allowlist 確認要、Phase 2 で正規化）
3. **source === "claude"**: `hit.sourceUrl` (Claude 推定 URL) を `addVenueFromUrl → confirmVenueFromUrl` の 2 段に通す。`hallucination` 対策として選択前に **"この URL で取り込みます" 中間 confirm** を 1 ステップ挟む

```ts
// クライアント側の選択ハンドラ（概念コード）
const sourceUrl = hit.source === "places"
  ? (await resolvePlaceWebsite(hit.placeId)) ?? mapsPlaceUrl(hit.placeId)
  : hit.sourceUrl;
const { extracted } = await addVenueFromUrl(sourceUrl);
if (!extracted) throw new Error("取り込めない URL です");
await confirmVenueFromUrl(extracted, sourceUrl);
```

### caching / debounce 戦略

| 層 | 戦略 |
|---|---|
| Client debounce | **300ms**（Google / Baymard 両推奨）。1 文字目の入力は発火しない |
| Minimum query length | **3 文字**（Unicode code point で判定。ひらがな / 漢字 / カナ / 英字共通）|
| Server cache | `query.trim().toLowerCase()` をキーに **60 秒 LRU**（メモリ、server action scope）|
| Places session token | input focus で発行 → 30 秒無入力または select で破棄 |
| AbortController | 新規 query 到着時、進行中 fetch を abort |

### エラーパス

| 状況 | サーバー側挙動 | UI 側挙動 |
|---|---|---|
| Query < 3 文字 | 早期 return `{ hits: [] }` | 「もう少し入力してください」subtle hint |
| Places quota 枯渇 | Tier 2 を skip、Tier 1/3 のみで hits 返却 + 内部 log | UI には表示せず（静かに degrade）|
| Places API timeout（3s）| Tier 1/3 の結果のみ返却 | UI は通常どおり |
| 全 Tier 0 件 | `{ hits: [] }` | 「見つかりませんでした」+ URL / 手動への導線 |
| Claude fallback エラー | エラーを握らず `{ hits: [], error: "..." }` | 0 件 UI と同じ fallback |
| Rate limit 超過 | `{ hits: [], throttled: true }` | 「少しゆっくり入力してください」ヒント、入力は lock しない |
| 不正文字 | XSS 防止のためクライアント側で validate、サーバー側は `z.string().max(100)` で reject | エラーは表示せず「見つかりませんでした」に丸める |

---

## 3. 画面設計

### 配置
`AddVenueSheet` 内、**URL 入力の直前**に新しい「式場名で検索」ブロックを追加。
URL 入力がヒーローだった現行から、**名前検索がヒーロー、URL 入力はセカンダリ** に格上げ（URL はパワーユーザー向け / 名前は一般ユーザー向けという割り切り）。
手動入力は現行どおり最下部アコーディオンに残す。

### State Matrix

| State | 条件 | UI |
|---|---|---|
| A. 初期 | Sheet open、input 未 focus | プレースホルダー「式場の名前を入れてみてください」、下に「ゼクシィなどの URL もそのまま貼れます」ヒント |
| B. 入力中 (empty) | focus あり、query = "" | placeholder 薄く、入力エリアにのみ gold ring |
| B2. 入力中 (1-2 文字) | `query.length < 3` | subtle hint 「3 文字以上で候補を探します」薄 gold |
| C. 入力中 (fetch 中) | `query.length >= 3`、pending | 上に pulse な ghost row 3 行（高さ 56px）、「候補を探しています」 aria-live |
| D. 結果あり | hits.length > 0 | 最大 8 行のサジェストリスト。各行：写真 (40×40) + primary name (明朝) + location (muted 11px) + source badge |
| E. 結果なし | hits = [] かつ query >= 3 文字かつ done | 「見つかりませんでした」ポスター + 3 つの救済 CTA：「URL を貼る」「手動で入力する」「別の言葉で探す」|
| F. エラー | network fail 等 | 「うまくつながりませんでした」+ 「もう一度」ボタン（1 回だけリトライ可）|
| G. 選択後 (取込中) | tap 済、confirmVenueFromUrl 実行中 | 既存の UrlSkeletonCard の progressive fill 機構をそのまま流用 |
| H. 選択後 (完了) | confirm 成功 | 既存 success toast + 式場詳細へ遷移 |

### ワイヤー（375px モバイル基準）

#### State A（初期）

```
┌─────────────────────────────────┐
│ HARETOKI · Venue                │  ← eyebrow
│ 新しい式場を、迎える              │  ← 明朝 20px light
│ 名前や URL で、ふたりの候補に。    │  ← sub 13.5px muted
│                                 │
│ ┌─────────────────────────────┐│
│ │🔍 式場の名前を入れてみてください││  ← search input (56px tall)
│ └─────────────────────────────┘│
│   アニヴェルセル、ぐらんぷりんせ、…  │  ← hint (11px gold-warm/70)
│                                 │
│ ─────── または URL から ──────    │  ← gold hairline divider
│                                 │
│ ┌─────────────────────────────┐│
│ │ 式場の URL を貼ってください    ││  ← 現行の URL textarea
│ │ (複数の場合は改行で区切り)      ││
│ └─────────────────────────────┘│
│                                 │
│ [ URL から取り込む ]              │
│                                 │
│ URL がない場合は 手動で入力する ▸  │
└─────────────────────────────────┘
```

#### State D（結果あり）

```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐│
│ │🔍 ぐらんぷりん      ×        ││  ← active search (gold ring)
│ └─────────────────────────────┘│
│                                 │
│ ┌─────────────────────────────┐│
│ │ [📷]                         ││  ← 40x40 photo or ghost
│ │  ぐらんぷりんせす葉山        ││  ← 明朝 14px, matched=bold
│ │  神奈川県 葉山町 · Places      ││  ← 11px muted + source badge
│ ├─────────────────────────────┤│  ← hairline divider
│ │ [📷] ぐらんぷりんせす京都     ││
│ │      京都府 左京区 · Places    ││
│ ├─────────────────────────────┤│
│ │ [  ] ぐらんぷりんせす仙台     ││
│ │      宮城県 仙台市 · Places    ││
│ └─────────────────────────────┘│
│  ↑ 1 タップで候補に加わります     │  ← affordance hint (11px gold)
└─────────────────────────────────┘
```

#### State E（結果なし）

```
┌─────────────────────────────────┐
│ ┌─────────────────────────────┐│
│ │🔍 あいまいな名前の式場  ×    ││
│ └─────────────────────────────┘│
│                                 │
│   ○                             │  ← 小さな cloud SkyChip
│                                 │
│  見つかりませんでした             │  ← 明朝 15px
│  名前を少し変えるか、下の方法で    │  ← 12.5px muted
│  試してみてください                │
│                                 │
│  [ URL を貼る ]  [ 手動で入れる ]  │  ← 44px CTA 2 個
└─────────────────────────────────┘
```

### ダークモード差分

| 要素 | Light | Dark |
|---|---|---|
| Input background | `bg-card` (#FFFCF8) | `bg-card` (`oklch(0.20 0.01 50)`)|
| Input focus ring | `ring-[var(--gold-warm)]/45` | `ring-[var(--gold-warm)]/65`（沈み対策で +20%）|
| Source badge (Places) | `bg-gold-subtle text-gold-warm` | `bg-gold-warm/18 text-gold-warm` |
| Sheet gradient | `--gradient-dawn` (cream→rose) | `--gradient-dawn` dark variant (ink blue) |
| サジェスト行 hover | `bg-muted/40` | `bg-white/[0.04]` |

---

## 4. ユーザー体験設計

### User Journey 3 シナリオ

#### シナリオ 1: 「名前聞いたから追加」（最頻、想定 60%）
> 妻が友人から「アニヴェルセル表参道いいよ」と聞いた帰宅後の電車内。

1. Home タブ右上「+」→ AddVenueSheet open（Sheet slide up 400ms）
2. 入力フォーカス、「あに」と打った瞬間はまだヒント表示
3. 「あにゔぇ」と打った瞬間 300ms 後にサジェスト 5 件表示（fade in 200ms + stagger 50ms）
4. 最上位「アニヴェルセル表参道」をタップ → AddVenueSheet 内で UrlSkeletonCard の progressive fill が走る
5. 15 秒後に success toast「✨ アニヴェルセル表参道 を迎えました」+ venue 詳細へ遷移

**Emotion Arc**: 期待（思い出した）→ 発見（名前が瞬時に出た）→ 安心（迎えました、という丁寧語）

#### シナリオ 2: 「あいまい記憶で探す」（想定 25%）
> 「確か、軽井沢の、石造りの、なんだっけ…」

1. 「かるいざわ」と入力 → Places から軽井沢エリアの establishment が来るが式場以外も混ざる
2. UI 上の source badge で「Places」表示、1 番上に「軽井沢ホテルブレストンコート」が来る
3. ユーザーは「これじゃない」と思い、さらに「かるいざわ 石」と打ち直す
4. Claude fallback が反応し「石の教会 内村鑑三記念堂」を候補に出す
5. タップ → confirmVenueFromUrl で公式サイトから情報取込

**Emotion Arc**: 曇り（思い出せない）→ 晴れ間（あ、これだ）→ 達成

**設計ポイント**: ハイブリッド検索で「Places の面」と「Claude の想起」の両方が機能する

#### シナリオ 3: 「既存プロジェクトと衝突」（想定 15%）
> 既に「アニヴェルセル表参道」は候補に入っているのを忘れていた。

1. 名前検索 → サジェスト表示されタップ
2. confirmVenueFromUrl の既存 dedupe matcher が hit → `mode: "merged"` で返却
3. UrlSkeletonCard の merged state（Layers icon + 「統合しました」badge）が表示
4. 「この式場は既に候補にあります。別サイトから N 件の情報が追加で見つかりました」と表示（現行の既存体験）
5. 「別の式場として迎える」の escape hatch も既存どおり使える

**設計ポイント**: 重複を自動的に正解に倒す。ユーザーに「既にありました」という否定的メッセージを出すのではなく、**「統合しました」とポジティブに扱う**（現行 UI 踏襲）。

### コピー原文

| 場面 | コピー | 理由 |
|---|---|---|
| Search placeholder | 「式場の名前を入れてみてください」 | 「〜しなさい」ではなく「〜してみて」で柔らかく |
| Empty hint (0 文字) | 「アニヴェルセル、ぐらんぷりんせ、…」 | 実在する名前の prefix 2 つで「動くもの」と理解してもらう |
| Short query hint (<3 文字) | 「3 文字以上で候補を探します」 | 仕様と理由を同時に伝える |
| Fetching | 「候補を探しています…」 | aria-live polite。「読み込み中」は copy 辞書に基づき回避 |
| Source badge (Places) | 「Places」 | 短く、コードの出所を明示。ブランド認知 |
| Source badge (Internal) | 「Haretoki」 | 既存 Venue DB 由来 (Phase 2)|
| Source badge (Claude) | 「参考」 | AI 推定の文字通りの意味、自信過剰にしない |
| Tap affordance | 「1 タップで候補に加わります」 | 「追加する」ではなく「候補に加わる」= ふたり主語 |
| Empty result headline | 「見つかりませんでした」 | 事実ベース、慰めすぎない |
| Empty result body | 「名前を少し変えるか、下の方法で試してみてください」 | 次の一歩を提示 |
| Empty result CTA 1 | 「URL を貼る」 | 動詞を前に |
| Empty result CTA 2 | 「手動で入れる」 | 動詞を前に、丁寧すぎない |
| Error toast | 「うまくつながりませんでした。また試してみてください」 | copy 辞書準拠 |
| Throttled hint | 「少しゆっくり入力してもらえると助かります」 | 命令形回避、ユーザーを責めない |
| Selected, loading | 既存の stage captions を流用（「ページから情報を読み取っています…」等）| 既存パイプラインとの一貫性 |
| Success toast | 「✨ {name} を迎えました」 | 「追加」→「迎える」置換 |

### Edge Cases

| ケース | 対応 |
|---|---|
| **重複 venue**（同 project 内）| `confirmVenueFromUrl` の dedupe がそのまま機能。merged state を既存 UI で表示 |
| **公開不可な会場**（Places で hit しない、公式 URL 無し）| Claude fallback で hit しなければ 0 件 → 手動入力へ誘導 |
| **英名のみ式場**（例: "Shima Kanko Hotel"）| 日本語入力 IME でも英名 1 文字ずつは通るので query 側は問題なし。Places 側は英名でも日本語でも引ける |
| **同名の複数拠点**（例: ぐらんぷりんせす X 県）| location 副題で区別。ユーザーが間違って別拠点を選んだら escape hatch「別の式場として迎える」で分離 |
| **特殊文字**（絵文字・emoji）| クライアント側で正規表現フィルタ、サーバー側は `z.string().max(100)` |
| **超長文** | 100 文字で切る、UI 上は overflow-ellipsis |
| **IME 変換中の入力** | `compositionstart` / `compositionend` を監視、変換中は debounce を発火しない |

### 離脱リカバリ

- Sheet を閉じて再度 open した場合、`urlInput` と同じく **search query も reset する**（既存 `resetForm` に追加）
- ただし未 confirm の extracted データが残っていたら「続きから迎える」bar を一番上に出す（将来 Phase 2）
- Phase 1 の MVP では **完全に捨てる** 動作を取る。理由：中途状態の復元は fresh な印象を損なうリスク > 復元の利便性

---

## 5. UI/UX 設計

### 使用トークン（DESIGN.md v4.2 準拠）

| 要素 | トークン / クラス | 備考 |
|---|---|---|
| Sheet 背景 | `background-image: var(--gradient-dawn)` | 既存 AddVenueSheet 流用 |
| Search input 背景 | `bg-card` | ivory |
| Search input 枠（rest）| `border-border` 1px | |
| Search input 枠（focus）| `ring-2 ring-[var(--gold-warm)]/45` + gold hairline | gold ≠ primary、AI 的な発見感を出すため gold |
| Search input 高さ | 56px（視覚）、44px hit（hit zone は `before:absolute inset -6`）| P5 遵守 |
| Search input padding | `px-4 py-3` | |
| Search icon | Lucide `Search` 18px、`text-[var(--gold-warm)]` | AI feature のため gold |
| Clear (×) | Lucide `X` 16px、`text-muted-foreground`、44px hit | query がある時のみ表示 |
| Suggestion list container | `bg-card rounded-[14px] border border-border` | 内部に divider |
| Suggestion row padding | `px-3.5 py-3` | |
| Suggestion row height | 56-64px（photo あり時 64px、photo 無し時 56px）| P5 |
| Suggestion row hover | `active:bg-muted/40 transition-colors` | 150ms |
| Suggestion thumbnail | 40×40、`rounded-lg`、`object-cover`、`VenueImage` tone=default | 写真取れない時は Skeleton |
| Primary text | `font-[family-name:var(--font-noto-serif-jp)] text-[14px] font-normal leading-snug` | DESIGN.md § Typography（式場名は明朝）|
| Matched substring | `font-medium` のみ適用（色は変えない）| Bold 禁止原則を避け weight は 400→500 で微差分化 |
| Secondary text | `text-[11.5px] text-muted-foreground` | 住所 |
| Source badge | `text-[10px] tracking-[0.04em] px-1.5 py-0.5 rounded bg-[var(--gold-subtle)] text-[var(--gold-warm)]` | Places 時 |
| Source badge (internal) | `bg-primary/10 text-primary` | Phase 2 |
| Divider | `border-border/60 h-px` | suggestion 間 |
| Empty state SkyChip | 既存 `SkyChip` cloud variant、size 40 | 「見つからない = 曇り」のメタファー |
| Motion (fade in list) | `--dur-fade` (300ms) + `--ease-out-luxe` | DESIGN.md § Motion budget |
| Motion (stagger) | `--stagger` (50ms) per row | |
| Motion (tap scale) | `active:scale-[0.98]` + `--dur-tap` (150ms) | |
| Motion (debounce ghost) | `animate-pulse` ghost row 3 本、opacity 0.4 → 0.7 loop | |

### 既存 SkyChip / EditorialHero 活用の余地

- **SkyChip**: State E（結果なし）で **cloud variant** を 40px サイズで中央配置。「曇り」メタファーで 0 件を温かく表現
- **EditorialHero**: この機能は Sheet 内なので EditorialHero は不使用。ただし Sheet header の eyebrow + 明朝タイトル構造は EditorialHero と同じ editorial tone を踏襲する
- **HaloTap**: 結果行のタップに HaloTap を **適用しない**（8 件並ぶ行にすべて halo は視覚ノイズ）。代わりに `active:scale-[0.98]` のみ。Halo は最終 confirm ボタンなどヒーロー要素に留める

### Accessibility

| 項目 | 実装 |
|---|---|
| タッチターゲット | Suggestion 行 64px、Clear ボタン 44px（hit zone は 44px）、Search input 56px | |
| コントラスト | Primary text on ivory: foreground `#2A2320` on `#FFFCF8` = 14.2:1 (WCAG AAA)、Muted text on ivory: `#7A7068` on `#FFFCF8` = 4.6:1 (WCAG AA 4.5 clear) | |
| コントラスト (dark) | foreground on dark card: `oklch(0.95 0.005 80)` on `oklch(0.20 0.01 50)` = ~13.1:1 | |
| focus visible | `ring-2 ring-[var(--gold-warm)]/45 ring-offset-0` on input, `outline-2 outline-offset-2` on suggestion row | |
| キーボード | ↑↓ で list 内移動、Enter で select、Esc で clear | |
| aria | Combobox pattern: `role="combobox"` + `aria-expanded` + `aria-autocomplete="list"` + `aria-controls="venue-search-results"` + `aria-activedescendant`、結果 ul は `role="listbox"`、各 li は `role="option"` | |
| sr-only | fetch 中は `role="status" aria-live="polite"` で「候補を探しています」。結果数も sr-only で「3 件の候補が見つかりました」 | |
| reduced motion | `prefers-reduced-motion: reduce` で stagger を即時化、pulse を止める | |

### Dark mode 補正（gold 沈み対策）

gold-warm は dark 背景で沈むため、次の調整を入れる:
- Search icon: `dark:text-[var(--gold-light)]` (lighter gold)
- Source badge: `dark:bg-[var(--gold-warm)]/22 dark:text-[var(--gold-light)]`
- focus ring: `dark:ring-[var(--gold-warm)]/65`（light の 45% → dark 65%）

### Micro-interactions

| Trigger | Animation | Duration / Easing |
|---|---|---|
| Input focus | gold ring fade in + placeholder color transition | 200ms / ease-out |
| Input blur (query empty) | ring fade out | 200ms / ease-in |
| Debounce 待機中（300ms の間） | input 右端に **subtle pulse dot** (3px gold, opacity 0.3 → 0.7)| 800ms loop |
| Fetch 開始 | ghost row 3 本 fade in + skeleton shimmer | 200ms fade / shimmer 1400ms loop |
| 結果出現 | 各行 y: 4 → 0 + opacity 0 → 1、stagger 50ms、max 300ms total | `--dur-fade` / `--ease-out-luxe` |
| Row hover | bg muted/40、transform none | 150ms / ease-out |
| Row tap | `scale: 0.98` 150ms、すぐ戻す + 0.15s 後に sheet body 部分の skeleton card 登場 | |
| Clear (×) tap | input query 消去 + scale 0.9 120ms | |
| Empty state 登場 | SkyChip fade in + 上昇 8px、コピー fade in 遅延 100ms | 400ms / `--ease-out-luxe` |
| Error → retry tap | 既存 shake animation 無し、retry ボタンに halo 1 回のみ | 250ms |

---

## 付録: Validation Checklist

- [x] モバイル 375px 幅で動作（wireframe 基準）
- [x] 44px タッチターゲット（入力 56px、Clear 44px hit、行 64px）
- [x] ダークモード差分を明記
- [x] active feedback（scale-[0.98]）
- [x] 空 / ローディング / エラー / throttled / 取込中 / 完了 の全状態
- [x] a11y (combobox pattern、aria-live、コントラスト、reduced motion)
- [x] Morning Light パレット遵守（gold = AI feature、rose は未使用）
- [x] 既存 copy lexicon 準拠（「迎える」「残す」「うまくつながりませんでした」）
- [x] 既存 confirmVenueFromUrl との接続点定義済み
- [ ] Refero 実画面検証（blocked、接続復旧後に polish）

## Open Trade-offs（reviewer に見てほしい）

1. **Tier 1（Haretoki Venue DB 横断検索）を MVP で落とす判断**: `Venue.isPublic` フラグ未実装が理由。これを Phase 2 回しにするのか、MVP で schema migration 含めて入れるのか要判断
2. **Places コスト soft cap 3,000 session/月**: 実ユーザー数から逆算した値ではないため、実運用で要再調整
3. **Claude fallback の hallucination リスク**: source badge「参考」だけで十分かは要議論。「正式 URL が確認できない候補です」の一行を add すべきか
4. **サジェスト行の写真表示**: Places API で photo_reference を取る = 追加の Place Photos API call（従量）。MVP では **写真なしで起動**、visual tone は Skeleton 枠のみで代替する案を推奨する
