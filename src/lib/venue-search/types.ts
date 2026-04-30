/**
 * F1 venue-name-search — shared types between the server action,
 * client combobox, and unit tests.
 *
 * Kept deliberately small: the server action returns the minimum the
 * client needs to render a suggestion row AND feed the selected hit
 * into the existing `addVenueFromUrl` → `confirmVenueFromUrl` pipeline
 * without a second round-trip for the common case.
 */

/** Which Tier produced the hit. */
export type VenueSearchSource = "places" | "claude" | "internal";

/**
 * A single suggestion row. `id` is a stable key for React reconciliation
 * (`"places:<placeId>"` / `"claude:<hash>"`). One of
 * `sourceUrl` / `placeId` / `existingVenueId` MUST be populated so the
 * selection handler has an actionable target.
 */
export interface VenueSearchHit {
  id: string;
  name: string;
  location: string | null;
  source: VenueSearchSource;
  /** Claude-tier hits give the public URL directly. Places tier leaves
   *  this null because the website needs a separate Place Details call. */
  sourceUrl: string | null;
  /** Google `place_id`. Present only when `source === "places"`. */
  placeId: string | null;
  /** Existing Haretoki Venue row id. Phase 2 — always null in MVP. */
  existingVenueId: string | null;
  /** Heuristic confidence. Used for list ordering ties + optional UI hint. */
  confidence: "high" | "medium" | "low";
}

/** Server action response envelope. */
export interface VenueSearchResponse {
  hits: VenueSearchHit[];
  /** Fatal error (auth / validation). 0-hit is NOT an error. */
  error?: string;
  /** Rate-limited for this project/minute. UI shows a soft hint. */
  throttled?: boolean;
}

/** Minimum chars before the server will call Tier 2/3. */
export const MIN_QUERY_LENGTH = 3;
/** Max chars accepted (zod cap). Protects upstream from pathological input. */
export const MAX_QUERY_LENGTH = 100;
/** Max suggestions returned. Baymard cap. */
export const MAX_SUGGESTIONS = 8;
