import { describe, it, expect } from "vitest";
import { buildSecurityTxt } from "@/app/.well-known/security.txt/route";

/**
 * RFC 9116 §3 mandates Contact + Expires fields, recommends
 * Preferred-Languages + Canonical + Policy. Pin the layout so a
 * future refactor doesn't drop a required field and silently fail
 * the securitytxt.org parser.
 */

describe("security.txt body", () => {
  const sample = {
    appUrl: "https://haretoki.vercel.app",
    contactEmail: "support@haretoki.app",
    expiresAt: "2027-05-02T00:00:00.000Z",
  };

  it("includes mailto: and HTTPS Contact lines (Contact is REQUIRED)", () => {
    const body = buildSecurityTxt(sample);
    expect(body).toContain("Contact: mailto:support@haretoki.app");
    expect(body).toContain("Contact: https://haretoki.vercel.app/support");
  });

  it("includes Expires (REQUIRED)", () => {
    const body = buildSecurityTxt(sample);
    expect(body).toContain("Expires: 2027-05-02T00:00:00.000Z");
  });

  it("includes Preferred-Languages (RECOMMENDED) — ja first, en fallback", () => {
    const body = buildSecurityTxt(sample);
    expect(body).toContain("Preferred-Languages: ja, en");
  });

  it("includes Canonical pointing at the well-known URL (RECOMMENDED)", () => {
    const body = buildSecurityTxt(sample);
    expect(body).toContain(
      "Canonical: https://haretoki.vercel.app/.well-known/security.txt",
    );
  });

  it("includes Policy linking the privacy doc (RECOMMENDED)", () => {
    const body = buildSecurityTxt(sample);
    expect(body).toContain("Policy: https://haretoki.vercel.app/privacy");
  });

  it("ends with a trailing newline (POSIX text-file convention)", () => {
    expect(buildSecurityTxt(sample).endsWith("\n")).toBe(true);
  });

  it("documents out-of-scope third parties so reporters don't waste effort", () => {
    const body = buildSecurityTxt(sample);
    expect(body).toContain("Out-of-scope");
    expect(body).toMatch(/anthropic/i);
    expect(body).toMatch(/supabase/i);
    expect(body).toMatch(/vercel/i);
  });
});
