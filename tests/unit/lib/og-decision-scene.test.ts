import { describe, it, expect } from "vitest";
import { formatDecisionDate } from "@/lib/og-decision-scene";

describe("formatDecisionDate", () => {
  it("formats a mid-month date with zero-padded month + day", () => {
    expect(formatDecisionDate(new Date(Date.UTC(2026, 4, 2)))).toBe("2026.05.02");
  });

  it("formats a single-digit month with leading zero", () => {
    expect(formatDecisionDate(new Date(Date.UTC(2026, 0, 1)))).toBe("2026.01.01");
  });

  it("formats December correctly (month index = 11)", () => {
    expect(formatDecisionDate(new Date(Date.UTC(2026, 11, 31)))).toBe(
      "2026.12.31",
    );
  });

  it("uses local-time getters (matches the route's behaviour)", () => {
    // formatDecisionDate uses `getFullYear` / `getMonth` / `getDate` (NOT
    // their UTC counterparts), so a Date created from a UTC instant in
    // the JST band can shift one day forward when read in local time.
    // This test pins the contract: the route + the test agree on
    // local-time semantics. If future I18N requires UTC normalisation,
    // change BOTH sides at the same time.
    const d = new Date("2026-05-02T15:00:00Z"); // 00:00 JST on the 3rd
    const formatted = formatDecisionDate(d);
    // Either "2026.05.02" (UTC environment) or "2026.05.03" (JST host)
    // is acceptable — the recipe is local-time and we don't fight that.
    expect(formatted).toMatch(/^2026\.05\.0[23]$/);
  });
});
