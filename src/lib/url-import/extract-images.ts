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
  // Shared-asset / promo-banner filters. zexy serves `/images/common/
  // ic_new_text.gif` (their "最新クチコミ" campaign banner) as og:image
  // on every venue page, which the fallback then rendered as the hero
  // photo. Drop anything that looks like a shared UI asset.
  /\/common\//i,
  /\/ic_/i,
  /\/assets?\//i,
  /\.gif($|\?)/i,
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
 * Public version of `shouldDrop` for callers outside this file (the
 * URL-import fallback in `venues.ts` also needs to filter asset /
 * promo-banner URLs before committing them to `photoUrls`).
 */
export function isLikelyAssetUrl(url: string): boolean {
  return shouldDrop(url);
}

/** Lazy-load attribute variants we've seen in the wild on wedding sites. */
const IMG_LAZY_ATTRS = [
  "data-src",
  "data-original",
  "data-lazy-src",
  "data-lazy",
  "data-echo",
  "data-bg",
  "data-ng-src",
  "data-srcset",
] as const;

/**
 * Match `background-image: url(...)` / `background: url(...)` occurrences
 * inside an inline style attribute. Handles optional single / double
 * quotes and arbitrary whitespace.
 */
const BG_IMAGE_RE = /background(?:-image)?\s*:\s*[^;]*url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;

/**
 * Match absolute image URLs (with a well-known extension) anywhere inside
 * a script blob. Used as a last-ditch "the site hid the img URLs inside
 * `window.__INITIAL_STATE__` or similar" recovery path.
 */
const SCRIPT_IMG_URL_RE =
  /https?:\/\/[^\s"'<>`]+?\.(?:jpe?g|png|webp|avif|gif)(?:\?[^\s"'<>`]*)?/gi;

/**
 * Scrape image URLs from an HTML string.
 *
 * Pulls from (in order — earlier sources tend to be the hero images):
 *  - `<img src>` / `srcset`, plus lazy-load variants (data-src, data-lazy,
 *    data-original, data-bg, data-ng-src, data-srcset, data-echo).
 *  - `<picture><source srcset>` and standalone `<source srcset>`.
 *  - `<noscript>` fallback markup — many sites hide the non-lazy `<img>`
 *    here for SEO + no-JS users; cheerio treats noscript contents as
 *    opaque text so we re-parse it.
 *  - Inline `style="background-image: url(...)"` — slider/hero divs
 *    typically render their image through CSS rather than `<img>`.
 *  - Inline `<script>` blobs containing JSON/JS with image URLs (e.g.
 *    `window.__INITIAL_STATE__`, Next.js `__NEXT_DATA__`) — regex-only
 *    extraction keyed on absolute-URL + image extension so we don't
 *    mis-pick JS snippets.
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

  // <img> with all known lazy-load attrs + src + srcset.
  $("img").each((_, el) => {
    const $el = $(el);
    const srcset = $el.attr("srcset");
    if (srcset) push(pickHighestResFromSrcset(srcset));
    for (const attr of IMG_LAZY_ATTRS) {
      const v = $el.attr(attr);
      if (!v) continue;
      if (attr === "data-srcset") {
        push(pickHighestResFromSrcset(v));
      } else {
        push(v);
      }
    }
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

  // <noscript> — contents are opaque text to cheerio's default parser, so
  // re-parse each block. Common SSR pattern: a real <img src> is hidden
  // inside <noscript> while the JS-visible <img> has data-src only.
  $("noscript").each((_, el) => {
    const inner = $(el).html();
    if (!inner) return;
    try {
      const $$ = cheerio.load(inner);
      $$("img").each((_, imgEl) => {
        const $img = $$(imgEl);
        const srcset = $img.attr("srcset");
        if (srcset) push(pickHighestResFromSrcset(srcset));
        push($img.attr("src") ?? null);
      });
    } catch {
      // malformed noscript body — skip
    }
  });

  // Inline style="background-image: url(...)" — slider / hero divs.
  $("[style]").each((_, el) => {
    const style = $(el).attr("style");
    if (!style) return;
    for (const m of style.matchAll(BG_IMAGE_RE)) {
      push(m[2] ?? null);
    }
  });

  // Inline <script> blobs — scan each (non-external) script for absolute
  // image URLs. Capped per-blob to avoid a single mega-bundle producing
  // thousands of hits that would flood the dedupe set.
  const PER_SCRIPT_CAP = 40;
  $("script:not([src])").each((_, el) => {
    const code = $(el).html();
    if (!code || code.length === 0) return;
    let taken = 0;
    for (const m of code.matchAll(SCRIPT_IMG_URL_RE)) {
      push(m[0]);
      if (++taken >= PER_SCRIPT_CAP) break;
    }
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
