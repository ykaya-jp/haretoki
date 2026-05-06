import { MODEL } from "@/lib/models";

/**
 * Review extraction — runs *in addition to* REVIEW_SUMMARY_PROMPT on the
 * single-URL "別サイトの口コミを追加" path. The summary prompt produces
 * one Review row with an AI-generated overview; this one extracts up to
 * 30 individual reviews from the same page so couples can read raw
 * voices, sort by date / rating, and filter to concerns.
 *
 * Why a separate prompt:
 *   - Keeps REVIEW_SUMMARY_PROMPT focused on synthesis (it already runs
 *     long; adding "and ALSO list 30 reviews" pushes maxTokens past
 *     2048 and risks truncation of the summary itself).
 *   - Lets us use Haiku here (faster, cheaper) — extraction is a
 *     mechanical lift from HTML body, not synthesis. Sonnet adds no
 *     value.
 *   - Runs in parallel with the summary (Promise.all) so wall time
 *     stays at max(summary, extraction) rather than sum.
 *
 * Schema mirrors `extractedVenueSchema.reviews` in venues.ts so the
 * downstream `saveExtractedReviews(...)` call works without translation.
 */
export const REVIEW_EXTRACTION_PROMPT = {
  system: `You extract individual wedding venue reviews from page text. Output JSON ONLY.

{
  "reviews": [
    {
      "title": "<original Japanese title or first sentence, max 200 chars, null if none>",
      "body": "<the actual review body in Japanese, 50-2000 chars>",
      "rating": <1-5 star rating, null if not visible>,
      "author": "<author handle / nickname / null. NEVER include real names — keep handles only>",
      "visitedAt": "<挙式日 or 投稿日 in YYYY-MM or YYYY-MM-DD form, null if not visible>"
    }
  ]
}

## Rules

- Return UP TO 30 distinct reviews. Quality over quantity — skip entries with body < 50 chars after stripping markup.
- Each review's body is the actual reviewer's voice — NOT the venue's marketing blurb, NOT category headers, NOT navigation.
- Strip site chrome / pagination / "もっと見る" / staff replies / ads.
- Skip reviews that are just star ratings with no text.
- Preserve the original Japanese voice. Do NOT paraphrase or summarise — keep the reviewer's words verbatim (within length cap).
- DO NOT invent reviews. If the page has 3 reviews, return 3. If 0, return [].
- Detect the rating from explicit number ("総合: 4.5") or stars ("★★★★☆"). Round half-stars to nearest integer.
- Author names: keep handles like "rinarina", "ハナヨメ2024", "匿名" but NEVER include real human names like "山田太郎" — null those out.
- Dates: prefer 挙式日 / 結婚式日 over 投稿日 if both are present.
- ORDER: newest first if dates are visible; otherwise as they appear on the page.

## Output

JSON only. No markdown fences, no preamble, no trailing text. Start with \`{\` and end with \`}\`.`,

  buildUserMessage: (pageText: string, venueName: string) =>
    `式場名: ${venueName}\n\n以下は口コミページの本文です。個別の口コミを最大 30 件抽出してください。\n\n${pageText.slice(0, 60_000)}`,

  model: MODEL.HAIKU,
  maxTokens: 8000,
};

export const REVIEW_EXTRACTION_PROMPT_VERSION = 1;
