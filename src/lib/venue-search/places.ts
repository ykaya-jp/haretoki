/**
 * Google Places API Tier 2 — thin fetch wrapper around Places Autocomplete
 * (new API, `places.googleapis.com/v1/places:autocomplete`) + Place Details
 * for resolving the selected place's website URL.
 *
 * Why the "new" Places API:
 *   - Cheaper per-session than the legacy Autocomplete-HTTP endpoint
 *   - Returns structured `primaryText` / `secondaryText` without the
 *     XML-from-1998 formatting of the legacy endpoint
 *   - Uses X-Goog-FieldMask so we only pay for the fields we actually
 *     render (suggestion.placePrediction fields only)
 *
 * GOOGLE_PLACES_API_KEY absence = silent skip (Tier 2 disabled, Tier 3
 * carries the feature). Consumers should only call these functions after
 * `isPlacesConfigured()` returns true.
 */

import type { VenueSearchHit } from "./types";

/** Is the API key configured? */
export function isPlacesConfigured(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY?.trim();
}

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL_TEMPLATE = "https://places.googleapis.com/v1/places/{placeId}";

/** Timeout for each upstream hit. Keeps the server action snappy. */
const PLACES_TIMEOUT_MS = 3000;

interface PlacesAutocompletePrediction {
  placeId?: string;
  /** Bolded display text. We ignore the `matches` array and just take text. */
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
}

interface PlacesAutocompleteResponse {
  suggestions?: Array<{ placePrediction?: PlacesAutocompletePrediction }>;
}

/**
 * Fetch Tier 2 autocomplete hits for `query`.
 * Returns [] on timeout / non-2xx / parse error — never throws.
 *
 * @param sessionToken Client-supplied uuid reused across focus→select.
 *   Google bundles the autocomplete + details call as one billable session
 *   only when the same token is passed.
 */
export async function fetchPlacesAutocomplete(
  query: string,
  sessionToken: string,
): Promise<VenueSearchHit[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);
  try {
    const res = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // FieldMask pay-per-field. Keep this list minimal.
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: query,
        sessionToken,
        // JP bias — filter out obvious foreign matches. Not hard-restricted
        // so Japanese couples planning overseas weddings still get results.
        regionCode: "jp",
        languageCode: "ja",
        // establishment ≈ business / venue. Filters out pure addresses.
        includedPrimaryTypes: ["establishment"],
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as PlacesAutocompleteResponse;
    const suggestions = json.suggestions ?? [];
    const hits: VenueSearchHit[] = [];
    for (const s of suggestions) {
      const p = s.placePrediction;
      if (!p?.placeId) continue;
      const name =
        p.structuredFormat?.mainText?.text ?? p.text?.text ?? null;
      if (!name) continue;
      const location = p.structuredFormat?.secondaryText?.text ?? null;
      hits.push({
        id: `places:${p.placeId}`,
        name,
        location,
        source: "places",
        sourceUrl: null, // resolved on selection via fetchPlaceWebsite
        placeId: p.placeId,
        existingVenueId: null,
        confidence: "medium",
      });
    }
    return hits;
  } catch {
    // Timeout / parse error — silent degrade per design §エラーパス.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a Places `placeId` to a usable URL for the import pipeline.
 * Preference: `websiteUri` (official venue site) → `googleMapsUri` (fallback).
 *
 * Returns null if neither could be resolved — the caller treats that as
 * "cannot import this hit" and should show the Tier 3 / manual fallback.
 */
export async function fetchPlaceWebsite(
  placeId: string,
  sessionToken: string,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);
  try {
    const url = DETAILS_URL_TEMPLATE.replace("{placeId}", encodeURIComponent(placeId));
    const res = await fetch(`${url}?sessionToken=${encodeURIComponent(sessionToken)}`, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "websiteUri,googleMapsUri",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      websiteUri?: string;
      googleMapsUri?: string;
    };
    return json.websiteUri ?? json.googleMapsUri ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
