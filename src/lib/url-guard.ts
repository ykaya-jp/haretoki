/**
 * SSRF guard for user-supplied URLs that the server side will fetch.
 *
 * Blocks:
 *  - Non-HTTPS schemes (http / file / gopher / javascript)
 *  - Localhost & loopback (127.x, ::1)
 *  - RFC1918 private IPv4 (10.x, 172.16-31.x, 192.168.x)
 *  - Link-local (169.254.x incl. AWS IMDSv1) / IPv6 fe80::
 *  - Common metadata endpoints by hostname
 *
 * Returns a typed result so callers can surface a Japanese error without
 * leaking which check tripped.
 */

export type UrlGuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: "invalid" | "scheme" | "private" };

const PRIVATE_HOSTNAME_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./, // link-local + AWS/Azure/GCP metadata
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc[0-9a-f]{2}:/i, // IPv6 ULA
  /^metadata\.google\.internal$/i,
];

export function guardExternalUrl(raw: string): UrlGuardResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "scheme" };
  }
  const host = parsed.hostname.toLowerCase();
  for (const re of PRIVATE_HOSTNAME_PATTERNS) {
    if (re.test(host)) return { ok: false, reason: "private" };
  }
  return { ok: true, url: parsed };
}

export function isSameOriginRedirectPath(path: string): boolean {
  // Accept only relative paths that start with a single "/" and don't open a
  // protocol-relative navigation ("//evil.com") or include user-info ("@").
  if (typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("@")) return false;
  return true;
}
