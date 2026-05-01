import { describe, it, expect } from "vitest";
import {
  hashEmail,
  redactIp,
  extractRequestMeta,
} from "@/lib/audit-helpers";

/**
 * Pure-helper tests for the audit module. Imported from `@/lib/audit-
 * helpers` (not `@/server/audit`) so the spec runner doesn't
 * transitively pull Prisma + Sentry into the test process.
 */

describe("audit/hashEmail", () => {
  it("returns null for null / undefined / empty", () => {
    expect(hashEmail(null)).toBeNull();
    expect(hashEmail(undefined)).toBeNull();
    expect(hashEmail("")).toBeNull();
  });

  it("returns a 16-hex-char hash for valid email", () => {
    const h = hashEmail("test@example.com");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it("normalises case before hashing (same hash regardless of case)", () => {
    expect(hashEmail("Test@Example.com")).toBe(hashEmail("test@example.com"));
    expect(hashEmail("TEST@EXAMPLE.COM")).toBe(hashEmail("test@example.com"));
  });

  it("normalises whitespace", () => {
    expect(hashEmail("  test@example.com  ")).toBe(
      hashEmail("test@example.com"),
    );
  });

  it("different emails produce different hashes", () => {
    expect(hashEmail("a@x.com")).not.toBe(hashEmail("b@x.com"));
  });
});

describe("audit/redactIp", () => {
  it("returns null for null / undefined / empty", () => {
    expect(redactIp(null)).toBeNull();
    expect(redactIp(undefined)).toBeNull();
    expect(redactIp("")).toBeNull();
  });

  it("coarsens IPv4 to /24 (drops last octet)", () => {
    expect(redactIp("192.168.1.42")).toBe("192.168.1.0/24");
    expect(redactIp("10.0.0.255")).toBe("10.0.0.0/24");
  });

  it("coarsens IPv6 to /48 (keeps first 3 hextets)", () => {
    expect(redactIp("2001:db8:abcd:1234::1")).toBe("2001:db8:abcd::/48");
  });

  it("returns null for unparseable garbage (rather than guessing)", () => {
    // A regression here would silently store the raw garbage in the
    // ip_address column, breaking the "stays trustworthy" invariant.
    expect(redactIp("not-an-ip")).toBeNull();
    expect(redactIp("a:b")).toBeNull(); // too few hextets
  });

  it("trims whitespace before parsing", () => {
    expect(redactIp("  192.168.1.42  ")).toBe("192.168.1.0/24");
  });
});

describe("audit/extractRequestMeta", () => {
  function fakeReq(headers: Record<string, string>): {
    headers: { get: (name: string) => string | null };
  } {
    return {
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
      },
    };
  }

  it("prefers x-forwarded-for first hop", () => {
    const meta = extractRequestMeta(
      fakeReq({
        "x-forwarded-for": "203.0.113.5, 198.51.100.1, 10.0.0.1",
        "user-agent": "Mozilla/5.0",
      }),
    );
    expect(meta.ip).toBe("203.0.113.5");
    expect(meta.userAgent).toBe("Mozilla/5.0");
  });

  it("falls back to cf-connecting-ip then x-real-ip", () => {
    expect(
      extractRequestMeta(fakeReq({ "cf-connecting-ip": "203.0.113.7" })).ip,
    ).toBe("203.0.113.7");
    expect(
      extractRequestMeta(fakeReq({ "x-real-ip": "203.0.113.8" })).ip,
    ).toBe("203.0.113.8");
  });

  it("returns null for both fields when no headers match", () => {
    const meta = extractRequestMeta(fakeReq({}));
    expect(meta.ip).toBeNull();
    expect(meta.userAgent).toBeNull();
  });
});
