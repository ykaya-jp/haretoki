/**
 * URL import domain router.
 *
 * Given a user-supplied venue URL, derive the set of related sub-pages that
 * carry additional structured data (photos / reviews / plans). Handlers are
 * keyed by hostname — unknown domains fall back to the single detail URL.
 *
 * This module is the sole entry-point the import pipeline uses to decide
 * which URLs to fetch beyond the input URL. Keep the surface small; each
 * per-domain file only has to export `derive(url: URL): RelatedUrls`.
 */

import { deriveZexy } from "./zexy";
import { deriveWeddingPark } from "./weddingpark";
import { deriveHanayume } from "./hanayume";
import { deriveMynavi } from "./mynavi";
import { deriveMwed } from "./mwed";

export interface RelatedUrls {
  /** The canonical detail page — always present. */
  detail: string;
  /** Optional photo gallery page. */
  photos?: string;
  /** Optional review listing page. */
  reviews?: string;
  /** Optional plan/pricing page. */
  plans?: string;
  /** Domain key for telemetry / source mapping. */
  domain: DomainKey;
}

export type DomainKey =
  | "zexy"
  | "wedding_park"
  | "hanayume"
  | "mynavi"
  | "minna_no_wedding"
  | "unknown";

type DomainHandler = (url: URL) => Omit<RelatedUrls, "domain">;

const HANDLERS: Array<{ match: (h: string) => boolean; key: DomainKey; derive: DomainHandler }> = [
  {
    key: "zexy",
    match: (h) => h === "zexy.net" || h.endsWith(".zexy.net"),
    derive: deriveZexy,
  },
  {
    key: "wedding_park",
    match: (h) => h === "weddingpark.net" || h.endsWith(".weddingpark.net"),
    derive: deriveWeddingPark,
  },
  {
    key: "hanayume",
    match: (h) => h === "hana-yume.net" || h.endsWith(".hana-yume.net"),
    derive: deriveHanayume,
  },
  {
    key: "mynavi",
    match: (h) => h === "wedding.mynavi.jp" || h.endsWith(".mynavi.jp"),
    derive: deriveMynavi,
  },
  {
    key: "minna_no_wedding",
    match: (h) => h === "mwed.jp" || h.endsWith(".mwed.jp"),
    derive: deriveMwed,
  },
];

/**
 * Derive related sub-pages for a given venue URL.
 *
 * - The returned `detail` is the input URL, normalised (trailing slash, no
 *   tracking params).
 * - Unknown domains get `{ detail, domain: "unknown" }`, i.e. the pipeline
 *   still works but only fetches the single page.
 *
 * Throws for obviously malformed inputs so the server action can surface
 * a clean "invalid URL" error.
 */
export function deriveRelatedUrls(raw: string): RelatedUrls {
  const parsed = new URL(raw);
  const hostname = parsed.hostname.toLowerCase();
  const handler = HANDLERS.find((h) => h.match(hostname));
  if (!handler) {
    return { detail: stripTracking(parsed).toString(), domain: "unknown" };
  }
  const derived = handler.derive(parsed);
  return { ...derived, domain: handler.key };
}

/**
 * Remove common tracking parameters (yclid, gclid, utm_*, sa_*, vos, etc.) so
 * the derived URLs don't carry session-specific query state. Keeps semantic
 * params (`?page=2`) untouched.
 */
export function stripTracking(url: URL): URL {
  const out = new URL(url.toString());
  const drop: string[] = [];
  out.searchParams.forEach((_, key) => {
    const k = key.toLowerCase();
    if (
      k === "vos" ||
      k === "yclid" ||
      k === "gclid" ||
      k === "gclsrc" ||
      k === "fbclid" ||
      k === "msclkid" ||
      k === "inrlead" ||
      k === "cid" ||
      k === "_bdld" ||
      k.startsWith("utm_") ||
      k.startsWith("sa_")
    ) {
      drop.push(key);
    }
  });
  drop.forEach((k) => out.searchParams.delete(k));
  // Collapse trailing "?" when no params remain.
  if (out.searchParams.toString() === "") {
    out.search = "";
  }
  return out;
}
