# 0005. Claude prompt の正本を `docs/ai/prompts/*.system.md` に置く

- **Status**: Accepted
- **Date**: 2026-05-02 (`475fcc0` / `f86dbcf`) / 2026-05-02 (retroactively recorded)
- **Deciders**: yusuke.kaya

## Context

Phase 1 〜 Phase 2.A 前半の状態:

- Claude API の system prompt が **複数の場所に散らばっていた**:
  - `src/lib/prompts/coach-chat.ts` — TS file 内に文字列定数
  - `src/server/actions/venues.ts` の inline (URL_EXTRACTION_SYSTEM_PROMPT)
  - `src/server/actions/estimate-ai.ts` の inline (ESTIMATE_EXTRACT_SYSTEM_PROMPT)
  - `src/lib/prompts/onboarding.ts` / `comparison.ts` / `review-summary.ts` — TS only
- `docs/ai/prompts/coach.system.md` だけ md 仕様がある状態。残りは TS が **唯一の真実**
- `CLAUDE.md` / `AGENTS.md` には「prompt を変えたら md と ts を同 PR で同期する」規約があった **が、md が無いものが大半で規約が空回り**

このまま規模が増えると次の問題が起きる:

- AI agent が prompt を編集するときに「どこが正本か」が判断できない
- prompt の **生成方針 / 入力 / 出力 JSON 形 / model 選択理由 / cache 戦略 / PII 取り扱い** が TS コメントに散逸し、6 ヶ月後に「なぜこの output shape にしたか」が読めなくなる
- AI が prompt を勝手に書き換えても気づきにくい (drift 検知が組めない)

## Decision

**全 Claude prompt の正本を `docs/ai/prompts/<name>.system.md` の Markdown ファイルに置き、TS コードはその実装ペアとして同 PR で同期する**。具体的には:

1. **全 10 prompt を md 化** (Phase 2.A 二段階):
   - Round 1 (`475fcc0` 2026-05-02): coach / onboarding / comparison / review-summary / url-extraction / estimate-extract / matrix-insight / fit-reason / ritual / vibe-suggest の md 化
   - Round 2 (`f86dbcf` 2026-05-02): inline 配置だった `URL_EXTRACTION_SYSTEM_PROMPT` / `ESTIMATE_EXTRACT_SYSTEM_PROMPT` を `src/lib/prompts/url-extraction.ts` / `estimate-extract.ts` に切り出し、 全 10 prompt が `src/lib/prompts/*.ts` 配下に揃う構造へ統一
2. **md frontmatter を統一**: `name` / `pairs_with` (TS file path) / `model` / `maxTokens` / `last_synced` (YYYY-MM-DD)
3. **md は「何を / なぜ」、TS は「どう」**: Persona / Input / Output JSON shape / Generation or Extraction Rules / PII & Sanitize / Caller (file:line + retry/timeout) / Cache strategy / Model rationale / Update Protocol / Known Limits を md に書く。TS は実際の文字列だけ
4. **更新規約**: prompt を変えるときは **md → TS の順で同 PR で更新** する (仕様 → 実装)
5. **drift 検知 hook** は `harness-ai-maintenance-plan` Phase 2 で計画 (PostToolUse on `src/lib/prompts/**` → 対応 md に `stale: true` を立てる、未実装)

## Consequences

良かった点:

- **`CLAUDE.md` / `AGENTS.md` の "prompt md/ts 同期" 規約が機能するようになった**: md が全部揃ったので、AI agent に「md を見て」と指示できる
- **prompt の design rationale が永続化された**: model 選択理由 / cache 戦略 / PII 方針が md に残るため、 半年後の "なぜ Sonnet / なぜ Haiku" 議論が再発しない
- **inline prompt が消えた**: `src/server/actions/*.ts` を読むときに prompt 本体に視線が割かれなくなり、 Server Action のロジックに集中できる
- **PR レビュー観点が単純化**: prompt を変えた PR は「md 差分 + TS 差分が両方ある」を機械的にチェックできる

悪かった点 / 後始末:

- **同じ情報を 2 ヶ所 (md + ts) に持つコスト**: drift 検知 hook が無い間は人手で同期が必要。 `harness-ai-maintenance-plan` Phase 2 を早期に実装しないと、md が古くなる risk が残る
- **md frontmatter の `last_synced` を更新し忘れる**: 自動化が無い間は規律で守るしかない
- **md は Lint されない**: TS と違って tsc が通らない / typo がそのまま残る。E2E の prompt スモークでも catch しないため、月次レビューを `PENDING.md` で予約する必要
- **prompt を AI で生成するときの揺らぎ**: AI agent に「md だけ更新して」と言うと TS と分岐する。AI agent への指示には "md と ts を 1 PR で揃えてください" を毎回明記する必要 (`AGENTS.md` の "AI Call Conventions" に既記載)

## Alternatives considered

- **TS を正本にして md は生成物 (auto-doc)**: TS comment + JSDoc から md 自動生成する案。実装工数 + テンプレート設計が必要、また「人間が md を直接編集して仕様変更する」ワークフローが取れず、AI agent が md を読みに行く動線が途切れる
- **md に prompt 文字列も書いて TS は import するだけ**: 構造としては綺麗だが、build 時に md → TS string にする loader が必要。Next.js / Vercel のキャッシュ層と相性検証コストがかかる
- **prompt を DB に置く (admin UI から編集)**: 商用 SaaS なら筋が良いが、今は 1 人開発。version 管理は git の方が早い、 prompt 変更が「コードレビュー込みで」乗ってほしい
- **YAML frontmatter なし、本文 md だけ**: pair の TS file がどこにあるか判別できなくなる。frontmatter を残す

「md を正本、TS を実装ペア、両方を同 PR で同期」 という規約が AI agent + 1 人開発には最も摩擦が低い、と判断して採用。Phase 2.A round 2 (`f86dbcf`) の完了で全 10 prompt が `src/lib/prompts/*.ts` 配下に揃い、 inline 配置は廃止された。

## References

- Round 1: `475fcc0` "canonicalize 5 inline/ts prompts as docs/ai/prompts/*.system.md"
- Round 2: `f86dbcf` "P2 残4 prompts md + 2 inline→file extraction"
- 規約の置き場所: `CLAUDE.md` / `AGENTS.md` ("AI Call Conventions") / `docs/ai/prompts/README.md`
- drift 検知の計画: `docs/harness-ai-maintenance-plan.md` Phase 2 (未実装、`PENDING.md` E. Harness 自動化に登録)
- 関連 ADR: なし (今後 model strategy / cache strategy が変わるときに別 ADR を起票予定)
