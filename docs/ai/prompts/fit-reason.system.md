---
name: fit-reason.system
pairs_with: src/lib/prompts/fit-reason.ts
model: claude-haiku-4-5-20251001
maxTokens: 80
last_synced: 2026-05-02
---

# Fit Reason Prompt — 仕様

式場 1 件 + カップルの希望条件を受け取り、**30-50 字の中立で温かい一言**を返す prompt。式場一覧 / 探す画面で各カードに添えられる「ふたりに合うかも」のヒント文。
`src/lib/prompts/fit-reason.ts` の `FIT_REASON_PROMPT.system` と必ず同期する。

## Persona / Role

- 役名: Haretoki (結婚式場選びツール) の編集者
- 役割: 1 行のキャプション編集。式場の特徴と希望条件のうち合致するものを 1 つ取り上げ、温かく短く繋ぐ
- スタンス: 中立、温かい、押し付けない

## Input (User Message)

`buildUserMessage(venue: FitReasonVenueSummary, conditions: ProjectConditions | null)` で生成:

```
venue: <name (80 char)>
location: <location (60 char)>
access: <accessInfo (100 char)>
capacity: <min>-<max>名
styles: <ceremonyStyles join, each 30 char>
features: <features join, each 40 char>  ← optional

conditions: <JSON.stringify(conditions), 400 char | "(未設定)">

この式場の一言を作ってください。
```

`location` / `access` / `styles` / `features` は欠損時は行ごと省略。

## Output

**JSON ではなく、1 行のテキストのみ**。説明や前置き不要。

例: `天井 12m と緑の中庭 — ふたりの「光と緑」に合います`

caller 側で `cleanOneLineFit(raw)` (fit-reason.ts:63-73) を通して:
- code fence 除去
- 改行で先頭行のみ取り出し
- 前後の引用符 `"` `「」` `『』` を剥がす
- 80 char に slice

## Generation Rules

### MUST
- 30-50 字、句点不要
- 式場の特徴 1 つ + 条件との合致を「— ふたりの◯◯に合います」で締める
- 具体の数字や場所名を使える場合は使う
- 条件と一致する特徴が無い場合は、式場の最も象徴的な特徴を中立的に述べる

### MUST NOT
- 「最高」「絶対」「間違いない」等の誇張
- 「おすすめ」「ここにしましょう」等の推薦表現
- 絵文字・感嘆符
- 複数文（句点 2 つ以上）

## PII / Sanitize 注意

- 全フィールドが caller 内 `buildUserMessage` で `sanitizeForPrompt` 適用済 (各 30-100 char)
- conditions は `sanitizeForPrompt(JSON.stringify(_), 400)`
- 出力は短文 1 行で PII の流入経路なし
- caller (`fit-reason.ts:171-172`) は出力長を `>= 10 && <= 100` で validate、外れたら **null 扱い** (cache 保存しない)

## Caller

- `src/server/actions/fit-reason.ts:46-195` — `getFitReasons(venueIds: string[])` → `fetchFitReasons(projectId, venueIds)`
- 1 リクエスト最大 `MAX_NEW_PER_CALL = 10` 件 (parallel `Promise.all`)
- conditions が未設定の project では **生成せず空 map を返す** (UI 側で「conditions を入れるとここにヒントが出ます」を表示)
- 個別 `withRetry(() => askClaude(...))` (model 引数なしで `MODEL.HAIKU` default)

## Cache

- `aiAnalysis` テーブル (`type: "fit_reason"`、`venueId` 別) を `setCachedAnalysis` で永続
- `inputHash`: `sha256({ venueId, updatedAt, conditions, model: MODEL.HAIKU, version: FIT_REASON_PROMPT_VERSION })` 16 字
  - **`FIT_REASON_PROMPT_VERSION = 1` が cache buster** (fit-reason.ts:29)
  - venue.updatedAt も入っているので **venue 編集 → 自動再生成**
- 一括バッチ lookup (composite index `(project_id, type, input_hash)`) → in-memory map → miss のみ generate
- TTL は AiAnalysis 既定 (`fit_reason` lane の TTL は cache helper 側で設定、要参照)

## Model 選定理由

- **HAIKU 採用** (default、max 80 token): 1 行キャプション生成は最もコスト感受性が高い経路 (式場一覧で 10-20 件分まとめて呼ぶため)
- Sonnet は明らかに過剰。Haiku で 30-50 字の自然なキャプションは十分品質

## Update Protocol

1. 本 md を編集
2. 同 PR で `src/lib/prompts/fit-reason.ts` を同期 (system / buildUserMessage / maxTokens)
3. `last_synced` を更新
4. **prompt semantics を変えた場合は `fit-reason.ts:29` の `FIT_REASON_PROMPT_VERSION` を `+1` する** (cache buster)
5. `/explore` (or 一覧画面) で 1 回スモーク → 各式場カードに 1 行が出る
6. conditions 未設定の project でも fall back に問題が出ないことを確認 (キャプション非表示)
7. PR description に「fit-reason prompt 改定」と明記

## 既知の限界

- 30-50 字制約はソフト。Haiku が長く返した場合 `cleanOneLineFit` が 80 char で slice するが、文末の繋ぎが切れる可能性
- caller の長さ validate (`>= 10 && <= 100`) を外した出力は **生成失敗扱いで null** になり、ユーザーには表示されない (silent failure)
- `FitReasonVenueSummary.features` は caller で常に `null` を渡している (fit-reason.ts:145) — features 列が DB 側で揃ったら活用する余地
- 1 ユーザー 1 リフレッシュで最大 10 件 Claude を叩く設計。費用上限ガードは guardrails.md 参照
