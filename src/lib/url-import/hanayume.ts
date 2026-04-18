/**
 * Hanayume (hana-yume.net) URL handler.
 *
 * Venue URLs: /wedding/hall/{venueId}/. Sub-pages:
 *   /wedding/hall/{venueId}/photo/
 *   /wedding/hall/{venueId}/review/
 *   /wedding/hall/{venueId}/plan/
 */

import { stripTracking } from "./domain-router";

const VENUE_ID_RE = /\/wedding\/hall\/([^/]+)\/?/i;

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
  const base = `${origin}/wedding/hall/${venueId}`;
  return {
    detail: `${base}/`,
    photos: `${base}/photo/`,
    reviews: `${base}/review/`,
    plans: `${base}/plan/`,
  };
}
