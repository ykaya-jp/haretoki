/**
 * Hit normalisation — collapses duplicates across Tier 1/2/3 and caps the
 * list to MAX_SUGGESTIONS. The client then renders the result in order,
 * so we sort by (confidence desc, source priority, length asc).
 *
 * Dedupe key: normalised venue name + location prefix. Two Places hits
 * that collide on name but sit in different prefectures must both survive
 * (ぐらんぷりんせす葉山 vs ぐらんぷりんせす京都) — location disambiguates.
 */

import { MAX_SUGGESTIONS, type VenueSearchHit } from "./types";

/**
 * Reduce a display name to a dedupe key. Lowercase + strip whitespace +
 * strip punctuation. Works for ja/en/mixed because we only care about
 * collision avoidance, not linguistic correctness.
 */
export function normalizeHitName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\p{P}\p{S}]/gu, "");
}

/**
 * Location prefix key for dedupe.
 *
 * Use first 3 chars of the trimmed location — enough to distinguish
 * different prefectures ("神奈川県" vs "京都府") without forcing inputs
 * from different tiers to agree on the exact address format. Example:
 * "東京都港区" and "東京都" both reduce to "東京都" and collapse, which
 * is the desired behaviour because they refer to the same venue.
 */
function locationPrefix(location: string | null): string {
  if (!location) return "";
  return location.trim().slice(0, 3);
}

function sourceWeight(source: VenueSearchHit["source"]): number {
  // Tier priority: internal (0 cost, brand-controlled) > places (paid)
  // > claude (AI-inferred). Ties inside the same Tier fall back to
  // confidence then the input order we received.
  if (source === "internal") return 0;
  if (source === "places") return 1;
  return 2;
}

function confidenceWeight(c: VenueSearchHit["confidence"]): number {
  if (c === "high") return 0;
  if (c === "medium") return 1;
  return 2;
}

/**
 * Merge + dedupe + cap. Pure — no I/O, safe to unit-test deterministically.
 *
 * @param buckets Ordered Tier buckets (internal, places, claude). Pass in
 * the order you want ties broken; we preserve the ordering within a tier.
 */
export function normalizeHits(buckets: VenueSearchHit[][]): VenueSearchHit[] {
  const seen = new Set<string>();
  const flat: VenueSearchHit[] = [];
  for (const bucket of buckets) {
    for (const hit of bucket) {
      const key = `${normalizeHitName(hit.name)}|${locationPrefix(hit.location)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      flat.push(hit);
    }
  }
  flat.sort((a, b) => {
    const bySource = sourceWeight(a.source) - sourceWeight(b.source);
    if (bySource !== 0) return bySource;
    const byConfidence =
      confidenceWeight(a.confidence) - confidenceWeight(b.confidence);
    if (byConfidence !== 0) return byConfidence;
    return a.name.length - b.name.length;
  });
  return flat.slice(0, MAX_SUGGESTIONS);
}
