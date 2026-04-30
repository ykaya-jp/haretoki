"use server";

/**
 * Resolve a `VenueSearchHit` (produced by `searchVenuesByName`) into a
 * concrete URL that the existing URL-import pipeline can consume.
 *
 * Why it lives in a server action:
 *   - `fetchPlaceWebsite` reads `GOOGLE_PLACES_API_KEY` from env, which
 *     must never reach the client bundle.
 *   - Keeps Tier resolution logic co-located with the search action.
 *
 * Returns `{ url: null }` when nothing importable can be derived
 * (e.g. Places hit with no website AND no maps URL). Caller falls back
 * to manual entry in that case.
 */

import { requireUser, requireProjectMembership } from "@/server/auth";
import { fetchPlaceWebsite } from "@/lib/venue-search/places";
import type { VenueSearchHit } from "@/lib/venue-search/types";

/**
 * Passed-in session token should be the same one that produced the hit,
 * so Google bills autocomplete + details as a single session.
 */
export async function resolveVenueSearchHitUrl(
  hit: VenueSearchHit,
  sessionToken: string,
): Promise<{ url: string | null }> {
  // Auth is kept intentionally cheap — the expensive work already
  // happened in `searchVenuesByName`. We still verify membership so an
  // unauth'd caller can't brute the Places details endpoint.
  const user = await requireUser();
  await requireProjectMembership(user.id);

  if (hit.source === "claude") {
    return { url: hit.sourceUrl ?? null };
  }
  if (hit.source === "internal") {
    // Phase 2: internal Venue copy path. For MVP, fall back to the
    // attached sourceUrl (likely null) so caller shows the manual route.
    return { url: hit.sourceUrl ?? null };
  }
  // Places — resolve website via Place Details (paid, but re-uses session).
  if (hit.source === "places" && hit.placeId) {
    const url = await fetchPlaceWebsite(hit.placeId, sessionToken);
    return { url: url ?? null };
  }
  return { url: null };
}
