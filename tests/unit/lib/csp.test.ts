import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildCspHeader,
  buildSupportingSecurityHeaders,
  generateCspNonce,
  isCspDisabled,
  isCspReportOnly,
} from "@/lib/csp";

describe("csp/buildCspHeader", () => {
  it("includes the nonce in script-src", () => {
    const header = buildCspHeader({ nonce: "abc123" });
    expect(header).toContain("'nonce-abc123'");
    expect(header).toContain("script-src");
  });

  it("uses 'strict-dynamic' so webpack-loaded chunks pass", () => {
    // Regression guard: without 'strict-dynamic', Next.js's nonce-tagged
    // entry script would fail to load its further chunks under strict
    // CSP. Pin the directive so a future edit doesn't drop it.
    const header = buildCspHeader({ nonce: "n" });
    expect(header).toContain("'strict-dynamic'");
  });

  it("opens script-src for Vercel + Sentry + PostHog", () => {
    const header = buildCspHeader({ nonce: "n" });
    expect(header).toContain("https://va.vercel-scripts.com");
    expect(header).toContain("https://browser.sentry-cdn.com");
    expect(header).toContain("https://eu.i.posthog.com");
  });

  it("respects a custom posthogHost override", () => {
    const header = buildCspHeader({
      nonce: "n",
      posthogHost: "https://us.i.posthog.com",
    });
    expect(header).toContain("https://us.i.posthog.com");
    // Default host should NOT also leak into the policy when an
    // override is supplied.
    expect(header).not.toContain("https://eu.i.posthog.com");
  });

  it("strips a trailing slash from the posthogHost override", () => {
    const header = buildCspHeader({
      nonce: "n",
      posthogHost: "https://eu.i.posthog.com/",
    });
    // Trailing-slash variant must not leak — that breaks CSP host
    // matching ("https://example.com/" is not a valid CSP source).
    expect(header).not.toContain("https://eu.i.posthog.com/ ");
    expect(header).toContain("https://eu.i.posthog.com");
  });

  it("denies frame-ancestors (clickjacking protection)", () => {
    const header = buildCspHeader({ nonce: "n" });
    expect(header).toContain("frame-ancestors 'none'");
  });

  it("denies object-src (Flash / plugin XSS)", () => {
    const header = buildCspHeader({ nonce: "n" });
    expect(header).toContain("object-src 'none'");
  });

  it("includes upgrade-insecure-requests as a value-less directive", () => {
    const header = buildCspHeader({ nonce: "n" });
    // The directive name appears alone (no values after it).
    expect(header).toMatch(/(^|; )upgrade-insecure-requests(; |$)/);
  });

  it("permits Supabase wss + https for Realtime + REST", () => {
    const header = buildCspHeader({ nonce: "n" });
    expect(header).toContain("https://*.supabase.co");
    expect(header).toContain("wss://*.supabase.co");
  });

  it("img-src permits https: and data: for venue photos + inline icons", () => {
    const header = buildCspHeader({ nonce: "n" });
    expect(header).toContain("img-src");
    expect(header).toMatch(/img-src[^;]* https:/);
    expect(header).toMatch(/img-src[^;]* data:/);
  });
});

describe("csp/generateCspNonce", () => {
  it("returns a base64url string of expected length (16 raw bytes)", () => {
    const n = generateCspNonce();
    // 16 bytes → base64url length 22 (no padding).
    expect(n).toHaveLength(22);
    expect(n).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("two consecutive calls return distinct values", () => {
    expect(generateCspNonce()).not.toBe(generateCspNonce());
  });
});

describe("csp/isCspDisabled + isCspReportOnly", () => {
  const originalDisabled = process.env.CSP_DISABLED;
  const originalReportOnly = process.env.CSP_REPORT_ONLY;

  beforeEach(() => {
    delete process.env.CSP_DISABLED;
    delete process.env.CSP_REPORT_ONLY;
  });

  afterEach(() => {
    if (originalDisabled === undefined) delete process.env.CSP_DISABLED;
    else process.env.CSP_DISABLED = originalDisabled;
    if (originalReportOnly === undefined) delete process.env.CSP_REPORT_ONLY;
    else process.env.CSP_REPORT_ONLY = originalReportOnly;
  });

  it("isCspDisabled defaults to false", () => {
    expect(isCspDisabled()).toBe(false);
  });

  it("CSP_DISABLED accepts '1' or 'true'", () => {
    process.env.CSP_DISABLED = "1";
    expect(isCspDisabled()).toBe(true);
    process.env.CSP_DISABLED = "true";
    expect(isCspDisabled()).toBe(true);
  });

  it("CSP_DISABLED rejects any other value (strict allow-list)", () => {
    process.env.CSP_DISABLED = "yes";
    expect(isCspDisabled()).toBe(false);
  });

  it("isCspReportOnly defaults to true (safer rollout — see csp.ts comment)", () => {
    // Inverted from previous default (false) after the 2026-05-03 prod-down
    // incident: enforce mode without nonce propagation in root layout
    // blocks every Next.js bundle. Until layout reads x-nonce + attaches
    // it to <Script>, report-only is the floor.
    delete process.env.CSP_REPORT_ONLY;
    expect(isCspReportOnly()).toBe(true);
  });

  it("CSP_REPORT_ONLY accepts '1' or 'true'", () => {
    process.env.CSP_REPORT_ONLY = "1";
    expect(isCspReportOnly()).toBe(true);
    process.env.CSP_REPORT_ONLY = "true";
    expect(isCspReportOnly()).toBe(true);
  });

  it("isCspReportOnly returns false only when explicitly set to '0' or 'false'", () => {
    process.env.CSP_REPORT_ONLY = "0";
    expect(isCspReportOnly()).toBe(false);
    process.env.CSP_REPORT_ONLY = "false";
    expect(isCspReportOnly()).toBe(false);
  });
});

describe("csp/buildSupportingSecurityHeaders", () => {
  it("includes 1-year HSTS with includeSubDomains + preload", () => {
    const h = buildSupportingSecurityHeaders();
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=31536000/);
    expect(h["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(h["Strict-Transport-Security"]).toContain("preload");
  });

  it("denies camera + geolocation + microphone via Permissions-Policy", () => {
    const h = buildSupportingSecurityHeaders();
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Permissions-Policy"]).toContain("geolocation=()");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
  });

  it("sets X-Content-Type-Options: nosniff", () => {
    expect(buildSupportingSecurityHeaders()["X-Content-Type-Options"]).toBe(
      "nosniff",
    );
  });

  it("sets Referrer-Policy: strict-origin-when-cross-origin", () => {
    expect(buildSupportingSecurityHeaders()["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});
