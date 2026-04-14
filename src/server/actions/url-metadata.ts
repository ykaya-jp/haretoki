/**
 * Static HTML metadata extraction for URL-based venue import.
 *
 * SPA/JS-rendered sites (Zexy, Hanayume, etc.) return near-empty textContent after
 * tag stripping because the main content is hydrated client-side. But for SEO/OGP
 * reasons, these sites still populate <meta> tags, Twitter Cards, JSON-LD
 * (Schema.org Venue/LocalBusiness/Organization), and <title> in the static HTML.
 *
 * This helper harvests those signals so we can feed Claude structured data even
 * when the visible body is empty. Regex-based (no JSDOM) to keep the serverless
 * Function cold-start cheap.
 */

export interface ExtractedMetadata {
  /** og:* and twitter:* tags merged (og:* wins on conflict) */
  og: Record<string, string>;
  /** Parsed JSON-LD blobs. Each element may be an object, an array (from @graph), or any JSON shape. */
  jsonLd: unknown[];
  /** <meta name="description">, <meta name="keywords">, etc. */
  meta: Record<string, string>;
  /** <title> contents, trimmed. */
  title: string | null;
}

/**
 * Decode the handful of named HTML entities we actually encounter in meta content.
 * (OGP content is usually already plain text or uses &amp;/&quot;/&#39; only.)
 */
function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Match a specific attribute value from a <meta ...> tag body.
 * Handles both attribute orders: <meta property="og:title" content="..."> and
 * <meta content="..." property="og:title">, plus single/double/no quotes.
 */
function readAttr(tag: string, name: string): string | null {
  const re = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i"
  );
  const m = tag.match(re);
  if (!m) return null;
  const raw = m[1] ?? m[2] ?? m[3] ?? null;
  return raw === null ? null : decodeHtmlEntities(raw);
}

export function extractMetadata(html: string): ExtractedMetadata {
  const og: Record<string, string> = {};
  const meta: Record<string, string> = {};
  const jsonLd: unknown[] = [];
  let title: string | null = null;

  // --- <title> ---
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const raw = decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim();
    title = raw.length > 0 ? raw : null;
  }

  // --- <meta ...> ---
  const metaTagRe = /<meta\b[^>]*>/gi;
  let metaMatch: RegExpExecArray | null;
  while ((metaMatch = metaTagRe.exec(html)) !== null) {
    const tag = metaMatch[0];
    const property = readAttr(tag, "property");
    const nameAttr = readAttr(tag, "name");
    const content = readAttr(tag, "content");
    if (content === null) continue;

    // og:* — from property attribute
    if (property && /^og:/i.test(property)) {
      og[property.toLowerCase()] = content;
      continue;
    }
    // twitter:* — usually on name attribute; merge into `og` under a "twitter:*" key
    // BUT also alias the most useful ones to og:* equivalents when og:* missing.
    if (nameAttr && /^twitter:/i.test(nameAttr)) {
      const key = nameAttr.toLowerCase();
      og[key] = content;
      // Alias to og:* if absent, so callers can treat og.title / og.description as canonical.
      const aliasMap: Record<string, string> = {
        "twitter:title": "og:title",
        "twitter:description": "og:description",
        "twitter:image": "og:image",
      };
      const alias = aliasMap[key];
      if (alias && og[alias] === undefined) {
        og[alias] = content;
      }
      continue;
    }
    // Standard name="description" / name="keywords" / etc.
    if (nameAttr) {
      meta[nameAttr.toLowerCase()] = content;
    }
  }

  // --- <script type="application/ld+json">...</script> ---
  const jsonLdRe =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  while ((ldMatch = jsonLdRe.exec(html)) !== null) {
    const raw = ldMatch[1].trim();
    if (!raw) continue;
    try {
      // Some sites HTML-encode ampersands inside JSON-LD for validator reasons.
      const decoded = raw.replace(/&amp;/g, "&");
      const parsed = JSON.parse(decoded);
      jsonLd.push(parsed);
    } catch {
      // Silently skip malformed blocks — they're rarely the primary signal and
      // a single bad block shouldn't poison the whole extraction.
    }
  }

  return { og, jsonLd, meta, title };
}

/**
 * True when the metadata contains at least one usable signal for Claude.
 * Used to decide whether to abort with "JavaScript必須" or proceed with
 * OGP-only extraction.
 */
export function hasUsefulMetadata(md: ExtractedMetadata): boolean {
  if (md.title && md.title.length > 0) return true;
  if (md.og["og:title"] || md.og["og:description"]) return true;
  if (md.jsonLd.length > 0) return true;
  if (md.meta["description"]) return true;
  return false;
}

/**
 * Build a compact text blob for Claude that emphasises structured metadata
 * over raw (possibly empty) body content.
 */
export function buildMetadataPrompt(
  url: string,
  md: ExtractedMetadata,
  textContent: string
): string {
  const pickTitle = md.og["og:title"] ?? md.title ?? "";
  const pickDescription =
    md.og["og:description"] ?? md.meta["description"] ?? "";
  const pickImage = md.og["og:image"] ?? "";
  const jsonLdStr =
    md.jsonLd.length > 0
      ? JSON.stringify(md.jsonLd).slice(0, 8000)
      : "(none)";

  const bodyExcerpt = textContent.slice(0, 2000);

  return [
    "=== ページ情報 ===",
    `URL: ${url}`,
    `タイトル: ${pickTitle}`,
    `説明: ${pickDescription}`,
    `画像: ${pickImage}`,
    `JSON-LD: ${jsonLdStr}`,
    "---",
    "本文抜粋（JS描画の場合は短い可能性あり）:",
    bodyExcerpt,
  ].join("\n");
}
