/**
 * HTML image scraper for URL-based venue import.
 *
 * Claude's extraction misses lazy-loaded images behind `data-src` / `srcset`
 * / `<picture><source>` because those never appear in rendered textContent
 * and only occasionally in JSON-LD. This helper runs cheerio over the raw
 * HTML and pulls every candidate image URL so we can feed a richer list to
 * the photo upload pipeline (Supabase re-upload).
 *
 * Picks max-resolution from srcset (largest `Npx` or `Nw` descriptor).
 * Drops common thumbnail markers: `_thumb`, `_50x50`, `_100x100`, `_small`,
 * and zexy-style micro sizes.
 */

import * as cheerio from "cheerio";

const DROP_PATTERNS = [
  /_thumb\.(jpe?g|png|webp|avif)/i,
  /_small\.(jpe?g|png|webp|avif)/i,
  /_icon\.(jpe?g|png|webp|avif)/i,
  /_50x50/i,
  /_100x100/i,
  /_75x75/i,
  /\/thumb\//i,
  /\/icons?\//i,
  /\/avatar/i,
  /\/logo/i,
  // Site-specific low-res paths occasionally show up as `s_xxx.jpg`; keep
  // them — real thumbnails usually come via explicit `_thumb` suffix.
] as const;

/**
 * Parse a `srcset` value and return the highest-resolution URL.
 * Handles both `Nw` and `Nx` descriptors:
 *   "a.jpg 400w, b.jpg 800w, c.jpg 1600w"    → c.jpg
 *   "a.jpg 1x, b.jpg 2x, c.jpg 3x"           → c.jpg
 *   "a.jpg" (no descriptor)                   → a.jpg
 */
export function pickHighestResFromSrcset(srcset: string): string | null {
  if (!srcset || srcset.trim() === "") return null;
  const candidates = srcset
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((entry) => {
      const parts = entry.split(/\s+/);
      const url = parts[0];
      const descriptor = parts[1] ?? "";
      const match = descriptor.match(/^([\d.]+)(w|x)$/i);
      // No descriptor → treat as 1x baseline.
      const weight = match ? parseFloat(match[1]) : 1;
      const isWidth = match?.[2]?.toLowerCase() === "w";
      // Widths usually dominate (100w..3000w); densities small (1x..3x).
      // Normalise to a comparable number — multiply density by 1000 so a 3x
      // doesn't beat a 400w image we know is wider.
      const normalised = isWidth ? weight : weight * 1000;
      return { url, normalised };
    })
    .filter((c) => c.url.length > 0);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.normalised - a.normalised);
  return candidates[0].url;
}

/**
 * Normalise a potentially-relative URL to an absolute URL using a base.
 * Returns null if the URL is empty, a data: URI, or otherwise malformed.
 */
function absolutize(
  raw: string | undefined | null,
  baseUrl: string,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed.startsWith("data:")) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function looksLikeImage(url: string): boolean {
  // Accept common image URLs. Skip anything that looks like a JS/CSS asset.
  if (/\.(jpe?g|png|webp|avif|gif)(\?|$)/i.test(url)) return true;
  // Some CDNs serve images from parameterised paths without an extension —
  // accept if the URL obviously lives under an images/photo/media dir.
  if (/\/(images?|photos?|media|uploads?)\//i.test(url)) return true;
  return false;
}

function shouldDrop(url: string): boolean {
  for (const re of DROP_PATTERNS) {
    if (re.test(url)) return true;
  }
  return false;
}

/**
 * Scrape image URLs from an HTML string.
 *
 * Pulls from:
 *  - `<img src>`
 *  - `<img data-src>` (common lazy-load attribute)
 *  - `<img data-original>` (lazyload.js legacy)
 *  - `<img srcset>` (picks highest resolution)
 *  - `<source srcset>` inside `<picture>`
 *
 * Absolutises relative paths against `baseUrl` (the page URL). Dedupes while
 * preserving insertion order. Returns up to `maxUrls` URLs.
 */
export function extractImagesFromHtml(
  html: string,
  baseUrl: string,
  maxUrls = 30,
): string[] {
  if (!html || html.length === 0) return [];

  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch {
    return [];
  }

  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string | null) => {
    if (!raw) return;
    const abs = absolutize(raw, baseUrl);
    if (!abs) return;
    if (seen.has(abs)) return;
    if (!looksLikeImage(abs)) return;
    if (shouldDrop(abs)) return;
    seen.add(abs);
    urls.push(abs);
  };

  // <img src>, <img data-src>, <img data-original>, <img srcset>
  $("img").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset");
    if (srcset) push(pickHighestResFromSrcset(srcset));
    push($el.attr("data-src") ?? null);
    push($el.attr("data-original") ?? null);
    push($el.attr("src") ?? null);
  });

  // <picture><source srcset>
  $("picture source").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) push(pickHighestResFromSrcset(srcset));
  });

  // Standalone <source srcset> (e.g. inside <video poster> fallback)
  $("source[srcset]").each((_, el) => {
    const srcset = $(el).attr("srcset");
    if (srcset) push(pickHighestResFromSrcset(srcset));
  });

  return urls.slice(0, maxUrls);
}

/**
 * Merge HTML-scraped image URLs with an existing list (from Claude + JSON-LD).
 * Deduplicates, preserves existing order, and caps at `maxUrls`.
 */
export function mergePhotoUrls(
  existing: string[],
  scraped: string[],
  maxUrls = 30,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...existing, ...scraped]) {
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= maxUrls) break;
  }
  return out;
}
