/**
 * Minna no Wedding (mwed.jp) URL handler.
 *
 * Venue URLs: /wedding_halls/{venueId}/ with sub-pages photo / review / plan.
 * The trailing segment naming is inconsistent across regions, so we only
 * derive the three sub-pages when the venue id is unambiguous.
 */

import { stripTracking } from "./domain-router";

const VENUE_ID_RE = /\/wedding_halls\/([^/]+)\/?/i;

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
  const base = `${origin}/wedding_halls/${venueId}`;
  return {
    detail: `${base}/`,
    photos: `${base}/photo/`,
    reviews: `${base}/review/`,
    plans: `${base}/plan/`,
  };
}
