/**
 * Content Security Policy header builder.
 *
 * 設計方針:
 *   - **strict CSP** with per-request nonce for inline scripts. Nonce
 *     is generated in middleware and surfaced via the `x-nonce`
 *     request header so Server Components can read it through
 *     `headers()`.
 *   - default-src self / no other origins → fail-closed posture; each
 *     directive then opens up exactly the third-parties we depend on
 *     (Vercel Analytics, Sentry, PostHog, Supabase, Anthropic).
 *   - **rollout-friendly**: env flag `CSP_REPORT_ONLY=1` switches to
 *     `Content-Security-Policy-Report-Only` header so the browser
 *     reports violations without blocking — useful for the first 1-2
 *     weeks of monitoring before enforcing. `CSP_DISABLED=1` is the
 *     escape hatch when something user-facing breaks and ops needs to
 *     unblock without redeploying.
 *
 * 各 directive の出典:
 *   - Vercel Analytics + Speed Insights: `va.vercel-scripts.com`,
 *     `vercel.live` (preview comments)
 *   - Sentry: `*.sentry.io` (DSN ingest), `*.ingest.sentry.io`
 *   - PostHog: `eu.i.posthog.com` (configurable via env)
 *   - Supabase: `*.supabase.co` (auth + storage + DB-via-PgBouncer)
 *   - Anthropic: `api.anthropic.com` (used by client-side stream
 *     consumers via `fetch` against our own origin's `/api/coach/
 *     stream`, so no client-side Anthropic origin needed)
 *   - Resend: server-side only, no client-side allow needed
 */

export interface BuildCspOptions {
  /** Per-request nonce, base64url. Caller (middleware) generates it. */
  nonce: string;
  /**
   * Optional override for the PostHog host. Falls back to the env
   * default so prod can swap regions without code change.
   */
  posthogHost?: string;
  /**
   * When true the returned policy is suitable for the
   * `Content-Security-Policy-Report-Only` header (browsers report
   * but don't block). Lets ops roll out cautiously.
   */
  reportOnly?: boolean;
}

/**
 * Build the CSP value as a single header string. Caller picks the
 * header name (`Content-Security-Policy` vs the report-only variant).
 *
 * The returned string is one logical policy joined with `; ` between
 * directives — match the format browsers parse (RFC 7762 / Level 3).
 */
export function buildCspHeader(opts: BuildCspOptions): string {
  const nonce = `'nonce-${opts.nonce}'`;
  const posthogHost = (opts.posthogHost ?? "https://eu.i.posthog.com").replace(
    /\/$/,
    "",
  );

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Inline scripts must carry the per-request nonce; Next.js bundles
    // load via webpack chunks from `/_next/`. `'strict-dynamic'` lets
    // Trusted scripts spawn other scripts (needed by webpack).
    "script-src": [
      "'self'",
      nonce,
      "'strict-dynamic'",
      // Vercel client analytics + speed insights
      "https://va.vercel-scripts.com",
      "https://vercel.live",
      // PostHog (analytics) — host is env-configurable
      posthogHost,
      // Sentry browser SDK — fetched from CDN when DSN configured
      "https://browser.sentry-cdn.com",
      "https://js.sentry-cdn.com",
    ],
    // Next.js + Tailwind require inline styles (`<style>` element +
    // many `style=""` attrs from generated utility classes). Browsers
    // don't accept nonce on style attributes, so `'unsafe-inline'`
    // here is the practical floor. Risk surface is small (style-only
    // injection rarely escalates to script execution).
    "style-src": ["'self'", "'unsafe-inline'"],
    // Inline `style` attributes (Editorial palette inline tokens, etc.)
    "style-src-attr": ["'self'", "'unsafe-inline'"],
    // Supabase Storage hosts venue photos; external venue sites also
    // serve photos at import time (URL-extract) — `https:` keeps it
    // open to those without enumerating every wedding-venue domain.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    // Webfonts: Google Fonts subset CDN (Next.js next/font emits
    // local URLs by default, but inline font-face data: stays open
    // for swap fallback)
    "font-src": ["'self'", "data:"],
    // Fetch / XHR / WebSocket targets. Sentry DSN ingest takes the
    // `*.ingest.sentry.io` subdomain; Supabase auth + realtime use
    // `*.supabase.co`; PostHog ingest uses the same host as scripts.
    "connect-src": [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://*.ingest.sentry.io",
      "https://*.sentry.io",
      posthogHost,
      "https://va.vercel-scripts.com",
      "https://vercel.live",
      "wss://ws-us3.pusher.com",
    ],
    // Manifest + service worker scope.
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    // No third-party iframes today; lock down for clickjacking +
    // spec-compliant iframe sandboxing.
    "frame-src": ["'self'"],
    "frame-ancestors": ["'none'"],
    // Belt-and-braces: deny mixed-content + force HTTPS on any
    // outbound subresource that snuck in via http://
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  // `upgrade-insecure-requests` is silently ignored by browsers when
  // delivered in a Report-Only policy (CSP Level 3 §6.1) and they emit
  // a noisy console warning. Skip it in report-only mode so prod stays
  // free of irrelevant warnings while we keep the directive in enforce
  // mode where it still matters.
  if (!opts.reportOnly) {
    directives["upgrade-insecure-requests"] = [];
  }

  return Object.entries(directives)
    .map(([key, values]) =>
      values.length === 0 ? key : `${key} ${values.join(" ")}`,
    )
    .join("; ");
}

/** Returns true when CSP should not be emitted at all (escape hatch). */
export function isCspDisabled(): boolean {
  const v = process.env.CSP_DISABLED;
  return v === "1" || v === "true";
}

/**
 * Returns true when CSP should be emitted in Report-Only mode.
 *
 * Default = **report-only** (safer rollout). Enforcement requires the
 * env var to be explicitly set to `"0"` or `"false"`.
 *
 * Why report-only is the realistic floor for now:
 *   - Next.js 16 with `cacheComponents: true` (next.config.ts) prerenders
 *     public routes (/, /login, /signup, /terms, /privacy) at build time
 *     and Vercel serves them with `x-vercel-cache: HIT`. The cached HTML
 *     was generated once with whatever nonce existed at build (or none),
 *     so per-request nonce injection is architecturally impossible for
 *     these routes — the shell HTML is frozen.
 *   - Strict-dynamic enforce mode requires *every* inline framework
 *     script (`self.__next_f.push`, $RT, $RX hydration helpers) to carry
 *     a valid per-request nonce. Cached prerender + per-request nonce
 *     are mutually exclusive.
 *   - The 2026-05-03 prod-down incident was the proof: enforce mode
 *     blocked all bundle scripts on cached /login and /signup.
 *
 * Realistic enforcement paths (all are large refactors, deferred):
 *   1. Migrate to hash-based CSP (every script change requires
 *      regenerating SHA256 hashes baked into the policy).
 *   2. Disable cacheComponents and force dynamic on every route (kills
 *      Vercel's prerender cache, ~3x cold start latency on landing).
 *   3. Wait for Next.js to ship nonce-with-PPR support upstream.
 *
 * The middleware (src/middleware.ts) emits the CSP on REQUEST headers
 * too, so dynamic routes' framework scripts CAN auto-nonce — that part
 * is wired and works for non-prerendered routes (/home, /coach, etc.
 * when authenticated). Report-only mode collects violations across the
 * entire surface so we can plan the eventual migration with real data.
 */
export function isCspReportOnly(): boolean {
  const v = process.env.CSP_REPORT_ONLY;
  if (v === undefined || v === "") return true;
  return v !== "0" && v !== "false";
}

/**
 * Generate a base64url nonce suitable for CSP. 16 bytes (~22 chars
 * after base64) is comfortably above the OWASP minimum (≥128 bits)
 * and short enough to keep header bloat negligible.
 */
export function generateCspNonce(): string {
  // Use Web Crypto so this works in both edge and Node middleware
  // runtimes without an explicit import.
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * Bundle of supporting security headers we set alongside CSP — same
 * `Strict-Transport-Security` + permissions-policy + referrer-policy
 * + x-content-type-options that the OWASP secure-headers baseline
 * recommends. Returned as a Record so the caller can add them to
 * `NextResponse.headers` in one loop.
 */
export function buildSupportingSecurityHeaders(): Record<string, string> {
  return {
    // 1 year HSTS, include subdomains, preload-list eligible. Revisit
    // when adding a non-www subdomain that doesn't speak HTTPS yet.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    // Browsers should never sniff a non-image as an image, etc.
    "X-Content-Type-Options": "nosniff",
    // Don't leak the full referrer URL to outbound links / images.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Disable browser features the app doesn't use. Camera + geolocation
    // are intentionally `()` (denied) — the venue-search GPS feature uses
    // a shared OS dialog through a click, not the API.
    "Permissions-Policy": [
      "accelerometer=()",
      "autoplay=()",
      "camera=()",
      "display-capture=()",
      "fullscreen=(self)",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "picture-in-picture=()",
      "usb=()",
    ].join(", "),
  };
}
