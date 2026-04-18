/**
 * Comparison matrix types — kept in a plain module (not "use server") so
 * client components and constants can live alongside type exports without
 * tripping Next.js's rule that server-action files expose only async fns.
 *
 * The action itself lives in `src/server/actions/checklist.ts` and
 * re-exports these so existing imports stay stable.
 */

/**
 * Maximum number of venues the comparison board can display at once.
 *
 * Rationale: at ~160px per column (grid template), 10 columns + the 160px
 * label gutter = 1760px of total horizontal scroll. Booking.com / Agoda
 * both cap at 4-5 for desktop-first flows, but our mobile-first design
 * uses scroll-snap-x-mandatory (one venue per viewport), so 10 stays
 * legible. Going beyond 10 makes the "which is best?" judgement noisy.
 */
export const COMPARE_MAX_VENUES = 10;

export interface ComparisonVenue {
  id: string;
  name: string;
  location: string | null;
  accessInfo: string | null;
  photoUrls: string[];
  scores: Array<{ dimension: string; score: number; source: string }>;

  /** Basic facts */
  costMin: number | null;
  costMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];

  /** Deep extraction — external review signal */
  externalRatingValue: number | null;
  externalReviewCount: number | null;

  /** Deep extraction — location detail */
  postalCode: string | null;
  streetAddress: string | null;

  /** Deep extraction — facilities */
  hasParking: boolean | null;
  parkingCapacity: number | null;
  hasShuttle: boolean | null;
  hasAccommodation: boolean | null;
  acceptsSecondParty: boolean | null;
  barrierFree: boolean | null;

  /** Deep extraction — cost breakdown */
  ceremonyFeeExact: number | null;
  productionFeeMin: number | null;
  productionFeeMax: number | null;
  serviceFeeRate: number | null;

  /** Deep extraction — operating */
  operatingHours: string | null;
  closedDays: string[];

  /** Deep extraction — cuisine */
  cuisineTypes: string[];
  chefCredentials: string | null;
}

export interface ComparisonAnswer {
  status: string | null;
  memo: string | null;
  numberValue: number | null;
  photoUrls: string[];
}

export interface ComparisonMatrix {
  venues: ComparisonVenue[];
  items: Array<{ id: string; category: string; subcategory?: string; question: string; type: string }>;
  answers: Record<string, Record<string, ComparisonAnswer>>; // [itemId][venueId] = answer
}
