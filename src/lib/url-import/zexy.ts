/**
 * Zexy (zexy.net) URL handler.
 *
 * Venue URLs follow /wedding/c_{id}/, with the following sub-pages exposing
 * additional structured data we can mine (verified against live zexy.net):
 *   /wedding/c_{id}/imageGallery/  → larger set of photo URLs
 *   /wedding/c_{id}/kuchikomi/     → individual review bodies (口コミ)
 *   /wedding/c_{id}/plan/          → wedding plans (挙式+披露宴の見積もり例)
 *
 * We derive all four URLs from any input URL that resolves to a venue id,
 * regardless of whether the user pasted a sub-page or the root detail.
 *
 * Note: the older /photo/ /review/ sub-paths used to work but now return 404;
 * the canonical paths are `imageGallery` and `kuchikomi`.
 */

import { stripTracking } from "./domain-router";

const VENUE_ID_RE = /\/wedding\/(?:kuchikomi\/)?(c_[0-9]+)\/?/i;

export function deriveZexy(url: URL): {
  detail: string;
  photos?: string;
  reviews?: string;
  plans?: string;
} {
  const match = url.pathname.match(VENUE_ID_RE);
  if (!match) {
    // Non-venue Zexy page — treat as detail only.
    return { detail: stripTracking(url).toString() };
  }
  const venueId = match[1];
  const origin = `${url.protocol}//${url.hostname}`;
  const base = `${origin}/wedding/${venueId}`;

  return {
    detail: `${base}/`,
    photos: `${base}/imageGallery/`,
    reviews: `${base}/kuchikomi/`,
    plans: `${base}/plan/`,
  };
}
