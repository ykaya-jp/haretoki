/**
 * Hanayume (hana-yume.net) URL handler.
 *
 * Hanayume venues live at root-level numeric IDs, NOT `/wedding/hall/{id}/`
 * (that URL shape returned 404 against the live site in April 2026).
 *
 * Real patterns (verified against https://hana-yume.net/726/):
 *   /{venueId}/         — detail (JSON-LD Organization)
 *   /{venueId}/photo/   — photo gallery (Organization + image[])
 *   /{venueId}/plan/    — wedding plan pricing
 *
 * Review sub-paths (`/review/`, `/kuchikomi/`, `/imageGallery/`) all 404 on
 * the live site, so we intentionally do not derive a `reviews` URL — the
 * extractor picks review body from the detail page's embedded 口コミ section
 * instead.
 */

import { stripTracking } from "./domain-router";

const VENUE_ID_RE = /^\/(\d{3,7})(?:\/|$)/;

export function deriveHanayume(url: URL): {
  detail: string;
  photos?: string;
  reviews?: string;
  plans?: string;
} {
  const match = url.pathname.match(VENUE_ID_RE);
  if (!match) return { detail: stripTracking(url).toString() };
  const venueId = match[1];
  const origin = `${url.protocol}//${url.hostname}`;
  const base = `${origin}/${venueId}`;
  return {
    detail: `${base}/`,
    photos: `${base}/photo/`,
    plans: `${base}/plan/`,
  };
}
