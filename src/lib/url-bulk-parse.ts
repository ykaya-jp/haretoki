/**
 * Extract HTTP(S) URLs from a free-form textarea blob for bulk venue import.
 *
 * Input is forgiving: users paste one-per-line, whitespace-separated, or a
 * mix with surrounding noise (e.g. from a memo app). We pull out every
 * token that looks like an http(s) URL and let the server-side SSRF guard
 * (url-guard.ts) reject private hosts / bad schemes later.
 *
 * Design notes:
 *  - We split on whitespace (incl. newlines / tabs / full-width spaces)
 *    instead of only "\n" so bullet-list paste like "1. https://… 2. https://…"
 *    yields 2 URLs, not 1 invalid token.
 *  - Dedupe preserves the *first* occurrence so the preview order matches
 *    the paste order — important for the "Nth done" progress UX.
 *  - Trailing punctuation (。、,.)) is stripped because JP memo apps and
 *    messaging clients often paste "…url.com/abc)。" with a period pinned.
 */

const TRAILING_PUNCT_RE = /[.,、。)\]\s]+$/u;
const LEADING_PUNCT_RE = /^[(\[「『\s]+/u;

/**
 * Pull out http(s) URLs from an arbitrary paste blob.
 *
 *   "https://a.com/x\nhttps://b.com" → ["https://a.com/x", "https://b.com"]
 *   "see https://a.com/x and https://a.com/x" → ["https://a.com/x"]
 *   "[1] https://a.com/x。" → ["https://a.com/x"]
 *
 * Non-URL tokens (plain text, empty lines) are dropped silently.
 */
export function parseBulkUrls(raw: string): string[] {
  if (!raw) return [];
  // Split on any run of whitespace — covers \n, \r, \t, regular space,
  // and U+3000 (full-width space used in JP input).
  const tokens = raw.split(/[\s\u3000]+/u);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tokRaw of tokens) {
    if (!tokRaw) continue;
    // Strip surrounding punctuation that often travels with a URL in prose
    // (bracketed citations, JP periods, trailing commas).
    const tok = tokRaw
      .replace(LEADING_PUNCT_RE, "")
      .replace(TRAILING_PUNCT_RE, "");
    if (!/^https?:\/\//i.test(tok)) continue;
    // Lightweight URL shape check — reject obvious malformed tokens
    // before we hand them to the sheet. The server's url-guard still
    // does the authoritative SSRF / scheme check.
    try {
      const u = new URL(tok);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

/** Upper bound on URLs accepted per bulk submit. Exported so UI / tests share it. */
export const BULK_URL_LIMIT = 10;
