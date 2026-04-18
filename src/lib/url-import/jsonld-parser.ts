/**
 * JSON-LD structured data parser for wedding venue pages.
 *
 * Walks every JSON-LD blob emitted by `extractMetadata()` and extracts the
 * subset of Schema.org fields we care about (LocalBusiness / Organization /
 * Event / WeddingVenue / Place). Handles @graph nesting, arrays of types,
 * and wrapping arrays.
 *
 * Preferred over Claude for structured fields: zero hallucination, zero cost,
 * stable across runs. Claude stays responsible for body-inferred fields
 * (parking, shuttle, cost breakdown etc.).
 */

export interface StructuredVenueData {
  name?: string;
  aggregateRating?: { value: number; count: number };
  geo?: { lat: number; lng: number };
  address?: {
    postal?: string;
    street?: string;
    locality?: string;
    region?: string;
  };
  phone?: string;
  openingHours?: string[];
  /** CDN-hosted image URLs (usually high-res). */
  images?: string[];
  events?: { name: string; startDate?: string; url?: string }[];
}

type JsonObject = Record<string, unknown>;

const VENUE_TYPES = new Set([
  "LocalBusiness",
  "Organization",
  "WeddingVenue",
  "EventVenue",
  "Place",
  "Restaurant",
  "BanquetHall",
]);

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function flatten(blob: unknown, out: JsonObject[]): void {
  if (Array.isArray(blob)) {
    for (const item of blob) flatten(item, out);
    return;
  }
  if (!isObject(blob)) return;
  out.push(blob);
  const graph = (blob as JsonObject)["@graph"];
  if (graph) flatten(graph, out);
  // Occasionally Schema wraps as `mainEntity` / `itemListElement`.
  for (const key of ["mainEntity", "itemListElement", "about", "subjectOf"]) {
    if (blob[key]) flatten(blob[key], out);
  }
}

function typeMatches(obj: JsonObject, set: Set<string>): boolean {
  const t = obj["@type"];
  if (typeof t === "string") return set.has(t);
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && set.has(x));
  return false;
}

function toStr(v: unknown): string | undefined {
  if (typeof v === "string") {
    const s = v.trim();
    return s.length > 0 ? s : undefined;
  }
  if (typeof v === "number") return String(v);
  return undefined;
}

function toNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toInt(v: unknown): number | undefined {
  const n = toNum(v);
  return n !== undefined ? Math.round(n) : undefined;
}

function extractImages(obj: JsonObject): string[] {
  const raw = obj["image"];
  const items = asArray(raw);
  const out: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      out.push(item);
    } else if (isObject(item)) {
      const url = toStr(item["url"]) ?? toStr(item["contentUrl"]);
      if (url) out.push(url);
    }
  }
  return out;
}

function extractAddress(
  obj: JsonObject,
): StructuredVenueData["address"] | undefined {
  const a = obj["address"];
  if (!a) return undefined;
  const addr = Array.isArray(a) ? a[0] : a;
  if (!isObject(addr)) {
    const asString = toStr(a);
    return asString ? { street: asString } : undefined;
  }
  const out: NonNullable<StructuredVenueData["address"]> = {};
  const postal = toStr(addr["postalCode"]);
  const street = toStr(addr["streetAddress"]);
  const locality = toStr(addr["addressLocality"]);
  const region = toStr(addr["addressRegion"]);
  if (postal) out.postal = postal;
  if (street) out.street = street;
  if (locality) out.locality = locality;
  if (region) out.region = region;
  return Object.keys(out).length > 0 ? out : undefined;
}

function extractGeo(obj: JsonObject): StructuredVenueData["geo"] | undefined {
  const g = obj["geo"];
  if (!isObject(g)) return undefined;
  const lat = toNum(g["latitude"]);
  const lng = toNum(g["longitude"]);
  if (lat === undefined || lng === undefined) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}

function extractAggregate(
  obj: JsonObject,
): StructuredVenueData["aggregateRating"] | undefined {
  const ag = obj["aggregateRating"];
  if (!isObject(ag)) return undefined;
  const value = toNum(ag["ratingValue"]);
  const count = toInt(ag["reviewCount"]) ?? toInt(ag["ratingCount"]);
  if (value === undefined || count === undefined) return undefined;
  if (value < 0 || value > 5) return undefined;
  if (count < 0) return undefined;
  return { value, count };
}

function extractOpeningHours(obj: JsonObject): string[] | undefined {
  const raw = obj["openingHours"];
  if (raw === undefined) return undefined;
  const items = asArray(raw);
  const out: string[] = [];
  for (const item of items) {
    const s = toStr(item);
    if (s) out.push(s);
  }
  return out.length > 0 ? out : undefined;
}

function extractEvents(objs: JsonObject[]): StructuredVenueData["events"] {
  const events: NonNullable<StructuredVenueData["events"]> = [];
  for (const obj of objs) {
    if (!typeMatches(obj, new Set(["Event"]))) continue;
    const name = toStr(obj["name"]);
    if (!name) continue;
    const startDate = toStr(obj["startDate"]);
    const url = toStr(obj["url"]);
    events.push({
      name,
      ...(startDate ? { startDate } : {}),
      ...(url ? { url } : {}),
    });
    if (events.length >= 10) break;
  }
  return events.length > 0 ? events : undefined;
}

function pickFirst<T>(items: (T | undefined)[]): T | undefined {
  for (const item of items) if (item !== undefined) return item;
  return undefined;
}

const STRONG_VENUE_TYPES = new Set([
  "LocalBusiness",
  "WeddingVenue",
  "EventVenue",
  "Place",
  "Restaurant",
  "BanquetHall",
]);

/**
 * Rank JSON-LD objects by how "venue-like" they look. Hanayume pages, for
 * example, emit an `Organization` blob for the operating company (parent
 * corporation, registered in Aichi) _before_ the `LocalBusiness` blob for
 * the actual venue. Taking the first hit would land us on the corporate HQ
 * — this scoring prefers the venue blob regardless of source order.
 */
function scoreVenueCandidate(obj: JsonObject): number {
  let score = 0;
  if (typeMatches(obj, STRONG_VENUE_TYPES)) score += 10;
  else if (typeMatches(obj, new Set(["Organization"]))) score += 1;
  if (isObject(obj["aggregateRating"])) score += 5;
  if (isObject(obj["geo"])) score += 3;
  if (obj["priceRange"]) score += 2;
  if (obj["image"]) score += 2;
  if (obj["telephone"] || obj["phone"]) score += 1;
  return score;
}

/**
 * Parse an array of JSON-LD blobs (as returned by `extractMetadata().jsonLd`)
 * into a single structured view. Merges information across all pages fetched
 * for the venue (detail + photos + plans).
 */
export function parseJsonLd(blobs: unknown[]): StructuredVenueData {
  const flat: JsonObject[] = [];
  for (const blob of blobs) flatten(blob, flat);

  const venueObjs = flat.filter((o) => typeMatches(o, VENUE_TYPES));
  // If no venue object found, consider every object (some sites misuse @type).
  const unsorted = venueObjs.length > 0 ? venueObjs : flat;
  // Score-sort so the strongest venue-shaped blob wins when a page emits
  // multiple candidates (e.g. parent Organization + venue LocalBusiness).
  const candidates = [...unsorted].sort(
    (a, b) => scoreVenueCandidate(b) - scoreVenueCandidate(a),
  );

  const names = candidates.map((o) => toStr(o["name"]));
  const ratings = candidates.map(extractAggregate);
  const geos = candidates.map(extractGeo);
  const addresses = candidates.map(extractAddress);
  const phones = candidates.map((o) =>
    toStr(o["telephone"]) ?? toStr(o["phone"]),
  );
  const hours = candidates.map(extractOpeningHours);

  // Images may appear on any object (even Event), so sweep the full flat list.
  const imageSet = new Set<string>();
  for (const o of flat) {
    for (const u of extractImages(o)) imageSet.add(u);
  }

  const result: StructuredVenueData = {};
  const name = pickFirst(names);
  if (name) result.name = name;
  const rating = pickFirst(ratings);
  if (rating) result.aggregateRating = rating;
  const geo = pickFirst(geos);
  if (geo) result.geo = geo;
  const address = pickFirst(addresses);
  if (address) result.address = address;
  const phone = pickFirst(phones);
  if (phone) result.phone = phone;
  const opening = pickFirst(hours);
  if (opening) result.openingHours = opening;
  if (imageSet.size > 0) result.images = Array.from(imageSet);
  const events = extractEvents(flat);
  if (events) result.events = events;
  return result;
}
