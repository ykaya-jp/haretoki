/**
 * Minna no Wedding (mwed.jp) URL handler.
 *
 * Real pattern (verified against https://www.mwed.jp/hall/10242/):
 *   /hall/{venueId}/         — detail (JSON-LD Event)
 *   /hall/{venueId}/photo/   — photo gallery
 *   /hall/{venueId}/plan/    — plans
 *
 * The previous path `/wedding_halls/{id}/` returned 404; `/review/` and
 * `/reviews/` also 404 on the current site. We intentionally skip the review
 * sub-page and rely on the detail page's embedded 口コミ block for reviews.
 */

import { stripTracking } from "./domain-router";

const VENUE_ID_RE = /^\/hall\/(\d+)(?:\/|$)/;

export function deriveMwed(url: URL): {
  detail: string;
  photos?: string;
  reviews?: string;
  plans?: string;
} {
  const match = url.pathname.match(VENUE_ID_RE);
  if (!match) return { detail: stripTracking(url).toString() };
  const venueId = match[1];
  const origin = `${url.protocol}//${url.hostname}`;
  const base = `${origin}/hall/${venueId}`;
  return {
    detail: `${base}/`,
    photos: `${base}/photo/`,
    plans: `${base}/plan/`,
  };
}
