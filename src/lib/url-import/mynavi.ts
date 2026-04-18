/**
 * Mynavi Wedding (wedding.mynavi.jp) URL handler.
 *
 * Venue URLs: /hall/{venueId}/ with sub-pages photo/ review/ plan/.
 */

import { stripTracking } from "./domain-router";

const VENUE_ID_RE = /\/hall\/([^/]+)\/?/i;

export function deriveMynavi(url: URL): {
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
    reviews: `${base}/review/`,
    plans: `${base}/plan/`,
  };
}
