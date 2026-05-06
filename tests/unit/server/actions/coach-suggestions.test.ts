/**
 * Unit tests for getCoachProactiveSuggestions — rule-based next-best-
 * action surfaces for the coach screen.
 *
 * Each test pins one of the rule paths in the implementation:
 *   Path 1 — zero venues → []
 *   Path 2 — decision exists → countdown + final-cost (caps to 2)
 *   Path 3 — favorites ≥ 2 + estimates ≥ 2 → compare-top-favorites
 *   Path 4 — visited ≥ 1 + estimates 0 → visit-without-estimate
 *   Path 5 — favorites ≥ 1 + visits 0 → favorite-without-visit
 *   Path 6 — venues ≥ 4 + favorites 0 → triage-many
 *
 * Output is always capped at 3 suggestions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
const mockVenueFindMany = vi.fn();
const mockFavoriteFindMany = vi.fn();
const mockVisitFindMany = vi.fn();
const mockEstimateCount = vi.fn();
const mockDecisionFindFirst = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
    },
    venueFavorite: {
      findMany: (...args: unknown[]) => mockFavoriteFindMany(...args),
    },
    visit: {
      findMany: (...args: unknown[]) => mockVisitFindMany(...args),
    },
    estimate: {
      count: (...args: unknown[]) => mockEstimateCount(...args),
    },
    decision: {
      findFirst: (...args: unknown[]) => mockDecisionFindFirst(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

import { getCoachProactiveSuggestions } from "@/server/actions/coach-suggestions";

const venueRow = (id: string, name: string) => ({ id, name });

describe("getCoachProactiveSuggestions", () => {
  beforeEach(() => {
    mockVenueFindMany.mockReset();
    mockFavoriteFindMany.mockReset();
    mockVisitFindMany.mockReset();
    mockEstimateCount.mockReset();
    mockDecisionFindFirst.mockReset();

    // Sensible empty defaults — each test overrides what matters.
    mockVenueFindMany.mockResolvedValue([]);
    mockFavoriteFindMany.mockResolvedValue([]);
    mockVisitFindMany.mockResolvedValue([]);
    mockEstimateCount.mockResolvedValue(0);
    mockDecisionFindFirst.mockResolvedValue(null);
  });

  it("returns [] when zero venues exist (Path 1)", async () => {
    const result = await getCoachProactiveSuggestions();
    expect(result).toEqual([]);
  });

  it("returns countdown + final-cost when a decision exists (Path 2)", async () => {
    mockVenueFindMany.mockResolvedValue([venueRow("v1", "晴海ガーデン")]);
    // 30 days from now
    const weddingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    mockDecisionFindFirst.mockResolvedValue({
      venue: { name: "晴海ガーデン" },
      weddingDate,
    });

    const result = await getCoachProactiveSuggestions();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("decision-countdown");
    // 29 or 30 depending on the exact ms boundary at test time
    expect(result[0].title).toMatch(/晴れの日まで (29|30) 日/);
    expect(result[0].iconKey).toBe("countdown");
    expect(result[1].id).toBe("decision-budget-final");
    expect(result[1].iconKey).toBe("receipt");
    expect(result[1].prompt).toContain("晴海ガーデン");
  });

  it("falls back gracefully when decision has no weddingDate", async () => {
    mockVenueFindMany.mockResolvedValue([venueRow("v1", "晴海ガーデン")]);
    mockDecisionFindFirst.mockResolvedValue({
      venue: { name: "晴海ガーデン" },
      weddingDate: null,
    });

    const result = await getCoachProactiveSuggestions();

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("晴れの日に向けて");
  });

  it("suggests comparing top-2 favorites when ≥2 favorites + ≥2 estimates (Path 3)", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "A 邸"),
      venueRow("v2", "B 邸"),
    ]);
    mockFavoriteFindMany.mockResolvedValue([
      { venue: venueRow("v1", "A 邸") },
      { venue: venueRow("v2", "B 邸") },
    ]);
    mockEstimateCount.mockResolvedValue(2);

    const result = await getCoachProactiveSuggestions();

    const compare = result.find((s) => s.id === "compare-top-favorites");
    expect(compare).toBeDefined();
    expect(compare!.title).toBe("A 邸 と B 邸 を比べる");
    expect(compare!.iconKey).toBe("compare");
  });

  it("suggests visit-without-estimate when visited ≥1 + estimates 0 (Path 4)", async () => {
    mockVenueFindMany.mockResolvedValue([venueRow("v1", "晴海ガーデン")]);
    mockVisitFindMany.mockResolvedValue([
      {
        completedAt: new Date(),
        venue: venueRow("v1", "晴海ガーデン"),
      },
    ]);
    mockEstimateCount.mockResolvedValue(0);

    const result = await getCoachProactiveSuggestions();

    const hint = result.find((s) => s.id === "visit-without-estimate");
    expect(hint).toBeDefined();
    expect(hint!.title).toContain("晴海ガーデン の見積もり");
    expect(hint!.iconKey).toBe("receipt");
  });

  it("suggests favorite-without-visit when favorites ≥1 + zero completed visits (Path 5)", async () => {
    mockVenueFindMany.mockResolvedValue([venueRow("v1", "晴海ガーデン")]);
    mockFavoriteFindMany.mockResolvedValue([
      { venue: venueRow("v1", "晴海ガーデン") },
    ]);
    // Visit row exists but completedAt is null — does NOT count as visited
    mockVisitFindMany.mockResolvedValue([
      {
        completedAt: null,
        venue: venueRow("v1", "晴海ガーデン"),
      },
    ]);

    const result = await getCoachProactiveSuggestions();

    const hint = result.find((s) => s.id === "favorite-without-visit");
    expect(hint).toBeDefined();
    expect(hint!.title).toContain("晴海ガーデン の見学");
    expect(hint!.iconKey).toBe("calendar");
  });

  it("suggests triage-many when venues ≥4 + favorites 0 (Path 6)", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "A"),
      venueRow("v2", "B"),
      venueRow("v3", "C"),
      venueRow("v4", "D"),
    ]);

    const result = await getCoachProactiveSuggestions();

    const triage = result.find((s) => s.id === "triage-many");
    expect(triage).toBeDefined();
    expect(triage!.title).toBe("4 件から優先順位を");
    expect(triage!.iconKey).toBe("list");
  });

  it("caps total suggestions at 3", async () => {
    // Concoct a state where many paths fire simultaneously — Paths 3 + 5
    // + 7 budget-reality should all fire. (No decision so Path 2 is off.)
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", "A"),
      venueRow("v2", "B"),
    ]);
    mockFavoriteFindMany.mockResolvedValue([
      { venue: venueRow("v1", "A") },
      { venue: venueRow("v2", "B") },
    ]);
    // visits empty → Path 5 fires
    mockEstimateCount.mockResolvedValue(2);

    const result = await getCoachProactiveSuggestions();

    expect(result.length).toBeLessThanOrEqual(3);
  });
});
