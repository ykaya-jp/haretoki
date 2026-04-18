/**
 * Cross-site venue deduplication.
 *
 * When a user pastes a URL for a venue that's already in their project (from
 * a different source — e.g. they added zexy earlier and are now pasting the
 * mwed page for the same venue), we must NOT create a second Venue row. This
 * module owns the matching + field-merging logic so `confirmVenueFromUrl`
 * can branch on `mode = "created" | "merged"`.
 *
 * Matching is layered and conservative: only confident matches go through;
 * borderline cases fall back to "new venue" and rely on the user's explicit
 * "別の式場として追加" escape hatch in the UI for edge overrides.
 *
 * All functions in this file are pure so they can be unit-tested cheaply.
 */

export interface VenueCandidate {
  name: string;
  location: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  normalizedName: string;
}

/**
 * Lowercase + remove whitespace and common punctuation that appears in venue
 * naming variants across sites. Preserves meaning-bearing characters.
 */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s　]+/g, "")
    .replace(/[・,.、。:：;；()（）「」『』【】\-—–_/／]+/g, "");
}

/** Great-circle distance in metres. Accurate to sub-metre at small scales. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h =
    s1 * s1 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** O(|a|·|b|) Levenshtein edit distance. Adequate for names <= 80 chars. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

export type MatchTier = "exact_postal" | "exact_geo" | "name_location" | "geo_near";

export interface ExistingVenueSummary {
  id: string;
  name: string;
  location: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  normalizedName: string | null;
}

export interface MatchResult {
  venue: ExistingVenueSummary;
  tier: MatchTier;
}

function locationOverlap(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  // Strip common prefixes (都道府県) for looser comparison.
  const na = a.replace(/[都道府県]/g, "");
  const nb = b.replace(/[都道府県]/g, "");
  // Consider a match if either contains the other's head segment.
  return na.includes(nb.slice(0, 4)) || nb.includes(na.slice(0, 4));
}

/**
 * Given an incoming candidate and a list of existing venues in the same
 * project, return the best match if any. Strict tiers first, then geo-only
 * fallback. Returns `null` if nothing passes the confidence bar.
 */
export function matchExistingVenue(
  candidate: VenueCandidate,
  existing: ExistingVenueSummary[],
): MatchResult | null {
  if (existing.length === 0) return null;

  const candGeo =
    candidate.latitude !== null && candidate.longitude !== null
      ? { lat: candidate.latitude, lng: candidate.longitude }
      : null;

  // Tier A1 — normalizedName exact + postalCode exact
  for (const v of existing) {
    if (!v.normalizedName || v.normalizedName !== candidate.normalizedName) continue;
    if (
      candidate.postalCode &&
      v.postalCode &&
      candidate.postalCode === v.postalCode
    ) {
      return { venue: v, tier: "exact_postal" };
    }
  }

  // Tier A2 — normalizedName exact + geo within 500m
  if (candGeo) {
    for (const v of existing) {
      if (!v.normalizedName || v.normalizedName !== candidate.normalizedName) continue;
      if (v.latitude === null || v.longitude === null) continue;
      const d = haversineMeters(candGeo, { lat: v.latitude, lng: v.longitude });
      if (d <= 500) return { venue: v, tier: "exact_geo" };
    }
  }

  // Tier B — normalizedName exact + coarse location overlap (市区町村 substring)
  for (const v of existing) {
    if (!v.normalizedName || v.normalizedName !== candidate.normalizedName) continue;
    if (locationOverlap(candidate.location, v.location)) {
      return { venue: v, tier: "name_location" };
    }
  }

  // Tier C — geo close (≤100m) AND short-name Levenshtein <= 3
  if (candGeo) {
    for (const v of existing) {
      if (v.latitude === null || v.longitude === null) continue;
      const d = haversineMeters(candGeo, { lat: v.latitude, lng: v.longitude });
      if (d > 100) continue;
      const dist = levenshtein(
        candidate.normalizedName,
        v.normalizedName ?? normalizeName(v.name),
      );
      if (dist <= 3) return { venue: v, tier: "geo_near" };
    }
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────
// Merge field plan
// ──────────────────────────────────────────────────────────────────────

/**
 * The subset of Venue columns the URL import pipeline may produce. Keeps
 * Prisma types out of this pure module.
 */
export interface VenueFieldBag {
  name?: string | null;
  location?: string | null;
  accessInfo?: string | null;
  capacityMin?: number | null;
  capacityMax?: number | null;
  ceremonyStyles?: string[] | null;
  costMin?: number | null;
  costMax?: number | null;
  dressBringIn?: string | null;
  dressBringInFee?: number | null;
  paymentMethodEnums?: string[] | null;
  maxInstallments?: number | null;
  vibeTags?: string[] | null;
  sourceUrls?: string[] | null;
  photoUrls?: string[] | null;

  // v2 deep-extraction
  externalRatingValue?: number | null;
  externalReviewCount?: number | null;
  postalCode?: string | null;
  streetAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phoneNumber?: string | null;
  hasParking?: boolean | null;
  parkingCapacity?: number | null;
  hasShuttle?: boolean | null;
  hasAccommodation?: boolean | null;
  acceptsSecondParty?: boolean | null;
  barrierFree?: boolean | null;
  ceremonyFeeExact?: number | null;
  productionFeeMin?: number | null;
  productionFeeMax?: number | null;
  serviceFeeRate?: number | null;
  operatingHours?: string | null;
  closedDays?: string[] | null;
  cuisineTypes?: string[] | null;
  chefCredentials?: string | null;
}

const ARRAY_UNION_FIELDS = [
  "ceremonyStyles",
  "paymentMethodEnums",
  "vibeTags",
  "sourceUrls",
  "photoUrls",
  "closedDays",
  "cuisineTypes",
] as const satisfies readonly (keyof VenueFieldBag)[];

const RANGE_MIN_FIELDS = [
  "capacityMin",
  "costMin",
  "productionFeeMin",
] as const;
const RANGE_MAX_FIELDS = [
  "capacityMax",
  "costMax",
  "productionFeeMax",
] as const;

export interface MergePlan {
  /** Field-level patch to apply via prisma.venue.update({ data }). */
  data: VenueFieldBag;
  /**
   * Keys that were newly set or meaningfully changed. Drives the UI
   * "this is what's new" chips in the merged preview.
   */
  updatedFields: string[];
}

function isNil(v: unknown): boolean {
  return v === null || v === undefined;
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

/**
 * Build a conservative update patch: only fill fields that are currently
 * null/empty on the existing venue; union arrays; take min/max on numeric
 * ranges; compute weighted average on aggregateRating.
 *
 * NEVER overwrites an existing non-null scalar with a different value —
 * human edits take precedence. If both sides have data we prefer the user's
 * stored value.
 */
export function mergeVenueFields(
  existing: VenueFieldBag,
  incoming: VenueFieldBag,
): MergePlan {
  const data: VenueFieldBag = {};
  const updatedFields: string[] = [];

  const fillIfMissing = <K extends keyof VenueFieldBag>(key: K): void => {
    if (isNil(existing[key]) && !isNil(incoming[key])) {
      data[key] = incoming[key] as never;
      updatedFields.push(key);
    }
  };

  // Scalars — fill if existing is null.
  const scalarKeys: (keyof VenueFieldBag)[] = [
    "location",
    "accessInfo",
    "dressBringIn",
    "dressBringInFee",
    "maxInstallments",
    "postalCode",
    "streetAddress",
    "latitude",
    "longitude",
    "phoneNumber",
    "hasParking",
    "parkingCapacity",
    "hasShuttle",
    "hasAccommodation",
    "acceptsSecondParty",
    "barrierFree",
    "ceremonyFeeExact",
    "serviceFeeRate",
    "operatingHours",
    "chefCredentials",
  ];
  for (const k of scalarKeys) fillIfMissing(k);

  // Arrays — union (skip if identical).
  for (const key of ARRAY_UNION_FIELDS) {
    const a = (existing[key] ?? []) as string[];
    const b = (incoming[key] ?? []) as string[];
    if (b.length === 0) continue;
    const merged = Array.from(new Set([...a, ...b]));
    if (!arraysEqual(merged, a)) {
      data[key] = merged as never;
      updatedFields.push(key);
    }
  }

  // Min ranges — take the smaller non-null.
  for (const key of RANGE_MIN_FIELDS) {
    const a = existing[key] as number | null | undefined;
    const b = incoming[key] as number | null | undefined;
    if (isNil(b)) continue;
    if (isNil(a) || (b as number) < (a as number)) {
      data[key] = b as never;
      updatedFields.push(key);
    }
  }

  // Max ranges — take the larger non-null.
  for (const key of RANGE_MAX_FIELDS) {
    const a = existing[key] as number | null | undefined;
    const b = incoming[key] as number | null | undefined;
    if (isNil(b)) continue;
    if (isNil(a) || (b as number) > (a as number)) {
      data[key] = b as never;
      updatedFields.push(key);
    }
  }

  // aggregateRating — weighted average when both sides have a count.
  const aV = existing.externalRatingValue;
  const aC = existing.externalReviewCount;
  const bV = incoming.externalRatingValue;
  const bC = incoming.externalReviewCount;
  if (!isNil(bV) && !isNil(bC)) {
    if (isNil(aV) || isNil(aC)) {
      data.externalRatingValue = bV as number;
      data.externalReviewCount = bC as number;
      updatedFields.push("externalRatingValue", "externalReviewCount");
    } else if ((bC as number) > 0) {
      const totalCount = (aC as number) + (bC as number);
      const weighted =
        ((aV as number) * (aC as number) + (bV as number) * (bC as number)) /
        totalCount;
      // Only write if the aggregate moved non-trivially.
      if (
        Math.abs(weighted - (aV as number)) >= 0.01 ||
        totalCount !== aC
      ) {
        data.externalRatingValue = Math.round(weighted * 100) / 100;
        data.externalReviewCount = totalCount;
        updatedFields.push("externalRatingValue", "externalReviewCount");
      }
    }
  }

  return { data, updatedFields: Array.from(new Set(updatedFields)) };
}
