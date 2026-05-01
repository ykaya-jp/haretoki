---
name: vibe-suggest.system
pairs_with: src/lib/prompts/vibe-suggest.ts
model: claude-haiku-4-5-20251001
maxTokens: (default via cachedAskClaude)
last_synced: 2026-05-02
---

# Vibe Suggest Prompt — 仕様

式場の基本情報を読み、`VIBE_TAGS` (10 種の気分タグ) から最大 4 つを推定する prompt。式場詳細ページの「雰囲気タグ」自動付与に使う。
`src/lib/prompts/vibe-suggest.ts` の `VIBE_SUGGEST_SYSTEM` と必ず同期する。

## Persona / Role

- 役名: 結婚式場のスタイリスト
- 役割: 与えられた式場の最小限の情報 (name / location / access / styles / sourceUrls) から、10 種の気分タグのうち最も合うものを **最大 4 つ** 選ぶ
- スタンス: タグ id のみ返す (label を返さない)。明確に該当しない場合は無理に埋めない

## Input (User Message)

`buildVibeSuggestUserMessage(venue: { name, location, accessInfo, ceremonyStyles, sourceUrls })` で生成:

```
式場名: <name>
エリア: <location>             ← location があれば
アクセス: <accessInfo>          ← accessInfo があれば
スタイル: <ceremonyStyles join>  ← styles があれば
参考URL: <sourceUrls の先頭 2 件>  ← あれば

この式場の雰囲気を表す気分タグを最大4つ選んでください。JSONのみ返してください。
```

system prompt 側に **利用可能な 10 タグ id : ラベル の一覧**が動的に埋め込まれる (vibe-suggest.ts:7-8、`VIBE_TAGS` の `id` / `label` を `\n` 区切りで列挙)。

## Output (JSON Shape)

```json
{ "tags": ["id1", "id2", "id3", "id4"] }
```

- 各 tag は `VIBE_TAGS` の `id` (英小文字 enum)
- 最大 4 件
- 該当なしなら空配列でも可

caller (`vibe-suggest.ts:73-81`) で:
- code fence 除去 (`stripCodeFences`)
- `JSON.parse` → zod (`suggestResultSchema = z.object({ tags: z.array(z.string()) })`)
- `VIBE_TAGS` の `id` set との照合で **不正 id を弾く**
- `slice(0, 4)` で件数強制

## Generation Rules

- **必ず JSON のみ**で回答 (説明 / 前置き / コードブロック禁止)
- 形式: `{"tags":["id1","id2"]}`
- **最大 4 つ**まで
- ラベル (例: 「ナチュラルライト」) ではなく **id (例: `natural_light`)** を返す
- 確信が持てないタグは無理に入れない (空配列が `null` 推測より良い)

## PII / Sanitize 注意

- 入力 venue 情報は **caller (`vibe-suggest.ts:54-60`) で sanitize 未適用** (生の `venue.name` / `venue.location` 等を渡している)
- 出力は enum id 配列のみで PII の流入経路なし
- 万一 LLM が enum 外の文字列を返しても caller の `VALID_IDS` set で弾かれる
- `sourceUrls` を最大 2 件まで参照させているため、URL に含まれる任意文字列が prompt 内に流入する余地あり (P3 課題: caller 側で `sanitizeForPrompt` 通す)

## Caller

- `src/server/actions/vibe-suggest.ts:32-82` — `suggestVibeTagsForVenue(venueId)`
- `requireVenueAccess` で project member だけが呼べる
- Claude 未設定時は **空配列で即 return** (degrade gracefully)
- 失敗時 (`raw == null` / parse 失敗) も空配列で return (throw しない)

## Cache

- `cachedAskClaude` 経由 (`src/lib/ai-cache.ts`) で **AiCache 永続キャッシュ**
- `promptVersion: VIBE_SUGGEST_PROMPT_VERSION = 1` (vibe-suggest.ts:16) を hash key に含める
  - **prompt 改定時はこの number を `+1` する**こと (caller 側 cache buster)
- vibe extraction は (venue facts, prompt) の純関数なので同じ venue → 同じ tags。同一 venue を 2 人のメンバーが同時開いても 1 回の Claude round-trip にまとまる

## Model 選定理由

- **HAIKU 採用** (default, via `cachedAskClaude`): 10 種 enum から 4 件選ぶ単純な分類タスク。Sonnet 不要
- maxTokens は `cachedAskClaude` 既定 (vibe-suggest.ts では明示なし。実装上は `askClaude` の default = 1024)
- 出力が `{ "tags": [...] }` のみなので 100-200 token で十分

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/vibe-suggest.ts` を同期 (system / buildVibeSuggestUserMessage)
3. `last_synced` を更新
4. **prompt semantics を変えた場合は `vibe-suggest.ts:16` の `VIBE_SUGGEST_PROMPT_VERSION` を `+1` する** (cache buster)
5. `VIBE_TAGS` (id / label) を変更した場合は本 md の Output 説明も同期 (id 命名規則を間違えると enum 外で全弾きになる)
6. 任意の式場で 1 回スモーク → vibe tag 0-4 件が UI に出る (`VIBE_TAGS` 内のもののみ)
7. PR description に「vibe-suggest prompt 改定」と明記

## 既知の限界

- 入力 venue 情報の sanitize 未適用 (`vibe-suggest.ts:54-60`)。`sourceUrls` 由来の任意文字列が prompt に紛れる余地 → caller 側で `sanitizeForPrompt` を噛ます P3 課題
- maxTokens 明示なし → `askClaude` の default 1024 が効くが、出力が短いので問題は出ていない
- `VIBE_TAGS` を編集して既存 venue の tag 化を一斉に再実行する仕組みなし (各 venue は次回呼び出し時に cache miss で更新される)
- LLM が `{tags: [...]}` 以外の shape (例: `{result: [...]}`) で返すと `suggestResultSchema.safeParse` で fail → 空配列で degrade
