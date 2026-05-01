---
name: ritual.system
pairs_with: src/lib/prompts/ritual.ts
model: claude-haiku-4-5-20251001
maxTokens: 256
last_synced: 2026-05-02
---

# Daily Ritual Prompt — 仕様

カップルが毎朝アプリを開いた瞬間に出る **静かで押しつけない 1 行の "朝の一言"** を生成する prompt。Haretoki のブランドメタファー (曇り → 晴れ間 → 晴れ) と直結しており、ホーム画面の最上部に配置される。
`src/lib/prompts/ritual.ts` の `RITUAL_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: Haretoki (結婚式場選びアプリ) の "朝の一言" を書く編集者
- 役割: ユーザーが毎朝アプリを開いた瞬間、**静かで押しつけない、けれど今日 2 分で動ける小さな一言**を返す
- スタンス: 命令しない、焦らせない、具体と柔らかさ

## Input (User Message)

`buildUserMessage(ctx: RitualContext)` で生成:

```
# 今日のおふたりの状況
stage: <start|adding|visiting|comparing|decided>
venues: <N>件
visited: <N>件
favorites: <N>件
favoriteNames: <name, name>           ← optional, sanitize 60 char
decision: <name>                       ← optional, sanitize 60 char
daysUntilWedding: <N>                  ← optional
latestEstimateTotal: ¥<X>万             ← optional
hasUnratedFavorite: true               ← optional
conditions: <JSON.stringify, 200 char> ← optional, sanitize 200 char

状況に応じた今日の一言 JSON を生成してください。
```

## Output (JSON Shape)

```json
{
  "weather": "cloudy" | "break" | "clear" | "sunny",
  "headline": "明朝で美しい一文 (20-40 字, 句点含む)",
  "mood": "補足 1 行 (~60 字)。今日のコンテキストに具体的に触れる",
  "ctaLabel": "短い動詞 (~8 字)",
  "ctaHref": "<相対パス、後述の allowlist のみ>"
}
```

`ctaHref` の allowlist (ritual.ts:119-132):
`/home /explore /candidates /candidates/duel /coach /journey /checklist /compare /mypage /mypage/saved-searches /notifications /settings`

`parseRitualOutput` (ritual.ts:138-183) で:
- `weather` enum チェック (4 値)
- `headline` 80 char clamp
- `mood` 120 char clamp
- `ctaLabel` 16 char clamp
- `ctaHref`: query / hash 除去後の base が allowlist に含まれていれば採用、外れたら `null`

## Generation Rules

### 天気の対応 (stage → weather)
- `cloudy`: 入力情報が少ない / `stage=start`
- `break`:  `stage=adding/visiting`、情報が見えてきた
- `clear`:  `stage=comparing`、本命が見えた
- `sunny`:  `stage=decided`、晴れの日に向かう

### トーン
- 命令しない: 「〜しましょう」より「〜してみませんか」
- 焦らせない: 「今日こそ」「早く」「絶対に」を禁止
- 具体と柔らかさ: 数字や式場名を使ってよい
- 絵文字なし、`!` なし
- 「おめでとう」は **decided stage のみ**

### 禁止
- ニュース的事実 (「今日は大安です」等)
- おすすめ式場の断定
- ユーザー情報の露出（メアド、ユーザー ID 等）
- 過度な比較 (「あの式場より◯」)

## PII / Sanitize 注意

- `favoriteNames` / `decision.venueName` は `sanitizeForPrompt(_, 60)` 適用
- `conditions` は `sanitizeForPrompt(JSON.stringify(_), 200)` 適用
- 出力に PII は含まれない設計（headline / mood は短文 + パースで clamp）
- ctaHref は **allowlist による厳格 validate** で SSRF / open redirect の余地なし

## Caller

- `src/server/actions/ritual.ts:177-250` — `fetchTodayRitual(projectId)`
- 1 日 1 回生成 → `DailyRitual` テーブル `(projectId, date)` UNIQUE で永続
- DB cache hit 時は LLM call ゼロ
- LLM 失敗 / `parseRitualOutput` null → `templateRitual(ctx)` で fallback (常に成功する静的テンプレ)
- 永続化は best-effort (`upsert`)、書込失敗してもユーザーへの応答は出る

## Cache

- **DB レベル cache**: `DailyRitual` テーブル `(projectId, date)` UNIQUE
- 同日 2 回目以降の `fetchTodayRitual` は LLM を叩かない (DB read 1 回のみ)
- Next.js `"use cache"` + `cacheTag(\`ritual:${projectId}:${todayKey}\`)` で edge cache layer も併用
- prompt 改定時の cache buster は **明示的なバージョン番号なし**
  - 新しい prompt の効果は **翌日以降** から (DailyRitual 行は date 単位で別 row)
  - 「今すぐ反映したい」場合は手動で当日行を削除する必要がある (prod 運用時の注意点)

## Model 選定理由

- **HAIKU 採用** (default、max 256 token): 1 日 1 回 / user の超低頻度経路 + 短文 1 行の生成。Haiku で十分品質
- max 256 token: weather + headline 40 字 + mood 60 字 + ctaLabel 8 字 + ctaHref で余裕

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/ritual.ts` を同期 (system / buildUserMessage / maxTokens、必要なら `ALLOWED_CTA_HREFS`)
3. `last_synced` を更新
4. ホーム画面で 1 回スモーク → 朝の一言が出る (今日初回 = LLM 経路、2 回目 = DB cache)
5. **prompt 改定の即時反映が必要なときは、本番 DB の `DailyRitual` の当日行を削除** (運用ノート)
6. 4 weather (cloudy / break / clear / sunny) に対応する stage で 1 回ずつ手動確認 (難しい場合はテンプレ fallback で品質保証)
7. PR description に「ritual prompt 改定」と明記

## 既知の限界

- prompt 改定の自動 cache buster がない (`promptVersion` 列が `DailyRitual` に無い)。改定即日反映には手動 DB 操作が必要
- ctaHref allowlist は手動メンテ。新しい authenticated route 追加時に本ファイル + ritual.ts:119-132 の同期を忘れると AI 提案が "(undefined)" 扱いで dropped
- `daysUntilWedding` の精度はユーザー入力依存 (未入力なら null で渡される)
- 同一 project 内で 2 人のメンバーが同日に開いても、1 回の DailyRitual を共有する (個別 personalize なし)
