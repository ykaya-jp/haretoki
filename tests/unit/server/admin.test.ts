import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminEmail } from "@/lib/admin-allowlist";

/**
 * Tests for `src/lib/admin-allowlist.ts` — the env-driven admin allow-list.
 * Pin the matrix so a refactor of `ADMIN_EMAILS` parsing doesn't
 * silently let the wrong people into /admin/* surfaces. Imported from
 * the lib path (not server/admin) so the test doesn't transitively
 * pull Prisma + Supabase init into the spec runner.
 */

describe("admin/isAdminEmail", () => {
  const original = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = original;
    }
  });

  it("returns false when ADMIN_EMAILS is unset (closed by default)", () => {
    expect(isAdminEmail("anyone@haretoki.app")).toBe(false);
  });

  it("returns false when email is null / undefined / empty", () => {
    process.env.ADMIN_EMAILS = "you@haretoki.app";
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("matches a single allow-listed email exactly", () => {
    process.env.ADMIN_EMAILS = "you@haretoki.app";
    expect(isAdminEmail("you@haretoki.app")).toBe(true);
    expect(isAdminEmail("notyou@haretoki.app")).toBe(false);
  });

  it("matches against a comma-separated allow-list", () => {
    process.env.ADMIN_EMAILS = "a@x.com, b@x.com,c@x.com";
    expect(isAdminEmail("a@x.com")).toBe(true);
    expect(isAdminEmail("b@x.com")).toBe(true);
    expect(isAdminEmail("c@x.com")).toBe(true);
    expect(isAdminEmail("d@x.com")).toBe(false);
  });

  it("comparison is case-insensitive on both sides", () => {
    process.env.ADMIN_EMAILS = "You@Haretoki.APP";
    expect(isAdminEmail("you@haretoki.app")).toBe(true);
    expect(isAdminEmail("YOU@HARETOKI.APP")).toBe(true);
  });

  it("ignores empty entries from a trailing comma / extra whitespace", () => {
    process.env.ADMIN_EMAILS = ",  a@x.com  ,  ,b@x.com,,";
    expect(isAdminEmail("a@x.com")).toBe(true);
    expect(isAdminEmail("b@x.com")).toBe(true);
    // Empty string must not silently match.
    expect(isAdminEmail("")).toBe(false);
  });
});
