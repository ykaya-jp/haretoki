/**
 * GET /.well-known/security.txt
 *
 * RFC 9116 — Responsible disclosure contact + policy. Static-text
 * response served from a dynamic route handler so the values track
 * env / app version without redeploying flat assets.
 *
 * Maintained alongside the support / legal pages (round 11). The
 * `Contact:` URL points at `/support` so a researcher can land on the
 * same form Couples use, while `Policy:` links to a public-facing
 * disclosure page (currently the privacy policy until a dedicated
 * disclosure write-up exists).
 *
 * Spec checker: https://securitytxt.org/ verifies the file format.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://haretoki.vercel.app";
const SECURITY_CONTACT_EMAIL =
  process.env.SECURITY_CONTACT_EMAIL ?? "support@haretoki.app";

/**
 * Body builder kept separate from the handler so a unit test can pin
 * the RFC 9116 layout without spinning up Next.js. Returns plain
 * text bytes (the `.txt` MIME type expects ASCII / UTF-8 lines).
 */
export function buildSecurityTxt(input: {
  appUrl: string;
  contactEmail: string;
  /** ISO-8601 expiration. Spec recommends ≤ 12 months out. */
  expiresAt: string;
}): string {
  const lines = [
    "# Haretoki — Responsible Disclosure",
    "# https://haretoki.vercel.app",
    "",
    `Contact: mailto:${input.contactEmail}`,
    `Contact: ${input.appUrl}/support`,
    `Expires: ${input.expiresAt}`,
    `Preferred-Languages: ja, en`,
    `Canonical: ${input.appUrl}/.well-known/security.txt`,
    `Policy: ${input.appUrl}/privacy`,
    "",
    "# Out-of-scope: third-party services we don't operate",
    "#   - api.anthropic.com (Anthropic)",
    "#   - *.supabase.co     (Supabase)",
    "#   - *.vercel.com      (Vercel)",
    "#   - *.resend.com      (Resend)",
    "#   - *.sentry.io       (Sentry)",
    "# Please report findings on those to the respective vendors.",
    "",
    "# Acknowledgements: we credit reporters publicly on request",
    "# (default: anonymous). Include a handle in the initial report.",
  ];
  return lines.join("\n") + "\n";
}

/**
 * Default expiration: 12 months from build time. Refresh by redeploying
 * (the build's `Date.now()` becomes the floor — the route handler is
 * dynamic so the date is computed per-request, but we still cap it at
 * 12 months out to satisfy the spec's "must not exceed 1 year" rule.
 */
function defaultExpires(now: Date = new Date()): string {
  const future = new Date(now.getTime());
  future.setUTCFullYear(future.getUTCFullYear() + 1);
  return future.toISOString();
}

export function GET() {
  const body = buildSecurityTxt({
    appUrl: APP_URL,
    contactEmail: SECURITY_CONTACT_EMAIL,
    expiresAt: defaultExpires(),
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Cache aggressively — the only thing that changes is the
      // expires-at, which is recomputed at request time anyway. 1
      // hour is enough to absorb a crawler burst without serving
      // stale Expires.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
