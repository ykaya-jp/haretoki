/**
 * R2 — pure aggregator for cross-venue review summaries on /compare.
 *
 * Lives in `lib/` (no Prisma deps) so spec runners can pin the
 * latest-aggregate-wins selection + sentiment averaging without
 * standing up a DB. The server action wrapper in
 * `src/server/actions/comparison.ts` does the I/O and per-venue
 * grouping, then calls `aggregateReviewsForVenue` on each group.
 *
 * What "an aggregate review" means here:
 *   The Review table holds two shapes (see saveExtractedReviews vs
 *   analyzeVenueReviews in src/server/actions/reviews.ts):
 *
 *     A) "individual" — one row per real-user review, body in
 *        aiSummary, no sentiment, no positive/negative highlights.
 *        categorySummary.individual carries title/author/visitedAt.
 *
 *     B) "aggregate" — one row per source URL summarising the WHOLE
 *        listing page via Claude. Carries sentiment + positive/
 *        negative highlights + a 220-char-ish summary.
 *
 * The /compare row needs the (B) shape. We pick the LATEST (B) row
 * (= newest fetchedAt with a sentiment value) and use its highlights
 * + summary directly. For sentimentAvg we average across ALL rows
 * that have sentiment.overall set — the operator may have run
 * analyze multiple times against the same venue with different
 * source URLs (= zexy + minna_no_wedding etc), so averaging gives
 * a more honest signal than picking just the latest.
 */

/** Cap on the visible summary text on /compare. Same budget as the
 *  Venue Whisper card — a ~220 JP-char summary fits inside one
 *  scroll-snap card without forcing a "see more" affordance. */
export const REVIEW_SUMMARY_MAX_CHARS = 220;

/** Highlights count budget for the cross-venue table. Top 3 keeps the
 *  desktop column compact AND lets the mobile collapsible read in one
 *  glance. */
export const HIGHLIGHTS_TOP_N = 3;

/**
 * Per-venue rolled-up review signal surfaced in ComparisonVenue.reviewSummary.
 * `summary === null` + `count === 0` is the "no reviews yet" rendering.
 */
export interface ReviewAggregate {
  /** Latest aggregate aiSummary, capped to REVIEW_SUMMARY_MAX_CHARS. Null
   *  when no aggregate row exists (= venue only has individual reviews,
   *  or no reviews at all). */
  summary: string | null;
  /** Top N strengths from the latest aggregate's positiveHighlights.
   *  Empty array when not available. */
  strengths: string[];
  /** Top N concerns. Empty array when not available. */
  concerns: string[];
  /** Total review row count (= individual + aggregate combined).
   *  Surfaced as the "口コミ N 件" badge on the mobile collapsible. */
  count: number;
  /** Mean of `sentiment.overall` across every row that has it.
   *  Null when no row has a numeric sentiment.overall. Range -1.0
   *  〜 1.0 by Claude's review-summary prompt contract. */
  sentimentAvg: number | null;
}

/**
 * Minimal row shape this aggregator needs from prisma. Keeping the
 * interface narrow lets the unit tests build fixtures without
 * importing the generated Prisma type.
 */
export interface ReviewRowForAggregate {
  aiSummary: string | null;
  /** sentiment is either Record<string, number> with .overall, or null. */
  sentiment: unknown;
  /** categorySummary may carry positiveHighlights[] / negativeHighlights[]
   *  for aggregate rows, or an `individual` payload for per-review rows. */
  categorySummary: unknown;
  fetchedAt: Date;
}

/**
 * Roll a single venue's review rows into a ReviewAggregate.
 *
 * Selection rule:
 *   - `summary` + `strengths` + `concerns` all come from the LATEST
 *     aggregate row (= newest fetchedAt that has sentiment != null).
 *     Picking by fetchedAt rather than first-seen ensures a re-run
 *     of analyzeVenueReviews supersedes the prior summary instead of
 *     mixing them — important because Claude's wording shifts run-
 *     to-run and stitching different runs reads as inconsistent.
 *   - `count` = total rows (= UI surfaces "口コミ N 件" so individual
 *     rows count too — they're real user voices even without AI
 *     summarisation).
 *   - `sentimentAvg` = mean of every numeric `sentiment.overall` we
 *     can find. Cross-source averaging is better signal than picking
 *     one source.
 */
export function aggregateReviewsForVenue(
  rows: ReadonlyArray<ReviewRowForAggregate>,
): ReviewAggregate {
  if (rows.length === 0) {
    return {
      summary: null,
      strengths: [],
      concerns: [],
      count: 0,
      sentimentAvg: null,
    };
  }

  // Find the latest row with a sentiment object — that's the
  // aggregate-shape row we'll source highlights + summary from.
  const aggregateRows = rows.filter(isAggregateRow);
  const latestAggregate = aggregateRows.length === 0
    ? null
    : [...aggregateRows].sort(
        (a, b) => b.fetchedAt.getTime() - a.fetchedAt.getTime(),
      )[0];

  const summary = latestAggregate?.aiSummary
    ? capLength(latestAggregate.aiSummary, REVIEW_SUMMARY_MAX_CHARS)
    : null;

  const cs = (latestAggregate?.categorySummary ?? null) as
    | { positiveHighlights?: unknown; negativeHighlights?: unknown }
    | null;
  const strengths = pluckHighlights(cs?.positiveHighlights);
  const concerns = pluckHighlights(cs?.negativeHighlights);

  // Average sentiment.overall across ALL rows that have it. The
  // numerator is the sum, denominator is the count of rows that
  // contributed — rows without sentiment.overall don't pull the mean
  // toward 0 (= proper "missing data" handling, not "missing = 0").
  let sentimentSum = 0;
  let sentimentCount = 0;
  for (const r of rows) {
    const s = extractSentimentOverall(r.sentiment);
    if (s !== null) {
      sentimentSum += s;
      sentimentCount += 1;
    }
  }
  const sentimentAvg =
    sentimentCount > 0
      ? Math.round((sentimentSum / sentimentCount) * 100) / 100
      : null;

  return {
    summary,
    strengths,
    concerns,
    count: rows.length,
    sentimentAvg,
  };
}

/**
 * Aggregate vs individual discriminator. An "aggregate" row is one
 * that came from `analyzeVenueReviews` and therefore has a non-null
 * `sentiment` object. Individual extracted rows leave sentiment null
 * (see saveExtractedReviews — it never writes sentiment). This is
 * the same predicate the Venue Whisper card on the venue PDP uses.
 */
function isAggregateRow(row: ReviewRowForAggregate): boolean {
  return row.sentiment !== null && typeof row.sentiment === "object";
}

function pluckHighlights(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      out.push(item.trim());
      if (out.length === HIGHLIGHTS_TOP_N) break;
    }
  }
  return out;
}

function extractSentimentOverall(value: unknown): number | null {
  if (value === null || typeof value !== "object") return null;
  const overall = (value as Record<string, unknown>).overall;
  if (typeof overall !== "number" || !Number.isFinite(overall)) return null;
  // Clamp to the prompt-contract range. A misbehaving model write
  // outside [-1, 1] shouldn't tip the dashboard sentiment.
  if (overall < -1) return -1;
  if (overall > 1) return 1;
  return overall;
}

function capLength(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
