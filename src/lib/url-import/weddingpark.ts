/**
 * Wedding Park (weddingpark.net) URL handler.
 *
 * Venue URLs follow /{pref}/{area}/{venueId}/, with sub-pages:
 *   /{...}/{venueId}/photos/   → photo gallery
 *   /{...}/{venueId}/reviews/  → review listing
 *   /{...}/{venueId}/plans/    → wedding plans
 */

import { stripTracking } from "./domain-router";

export function deriveWeddingPark(url: URL): {
  detail: string;
  photos?: string;
  reviews?: string;
  plans?: string;
} {
  const stripped = stripTracking(url);
  // Normalise trailing slash on the last segment, then drop any trailing sub-page
  // (photos/, reviews/, plans/) so we derive all four from the same base.
  const segments = stripped.pathname.split("/").filter(Boolean);
  const TRAILING_SUBPAGES = new Set(["photos", "reviews", "plans", "photo", "review", "plan"]);
  while (segments.length > 0 && TRAILING_SUBPAGES.has(segments[segments.length - 1].toLowerCase())) {
    segments.pop();
  }
  if (segments.length < 3) {
    // URL shape we don't recognise (e.g. top-level search page) — detail only.
    return { detail: stripped.toString() };
  }
  const base = `${stripped.protocol}//${stripped.hostname}/${segments.join("/")}`;
  return {
    detail: `${base}/`,
    photos: `${base}/photos/`,
    reviews: `${base}/reviews/`,
    plans: `${base}/plans/`,
  };
}
