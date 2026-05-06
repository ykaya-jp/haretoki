/**
 * Integration — preference vector → onboarding-recs / coach pipeline.
 *
 * Verifies that a couple's behavioral state (favorites + visits) flows
 * coherently through three downstream surfaces:
 *
 *   1. getPreferenceVector — turns favorites/visits into the
 *      cold/topVibes/topStyles aggregate.
 *   2. summarizePreferenceVector — formats the vector into the prompt
 *      string injected into onboarding-recs's Claude call.
 *   3. getCoachProactiveSuggestions — reads the same underlying state
 *      (count of favorites + visits + estimates + decision) and emits
 *      rule-based prompts.
 *
 * The "consistency" we pin here is the **count semantics**: if the
 * couple has 2 favorites + 2 estimates, both
 *   (a) the preference vector reports signalCount=2 (warm), AND
 *   (b) the coach surfaces the "compare top favorites" suggestion.
 * A regression that desynchronises these (e.g. one path ignores
 * deletedAt=null while the other doesn't) reads as "the AI rec used
 * stale state" or "the coach showed a stale prompt".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFavoriteFindMany = vi.fn();
const mockVisitFindMany = vi.fn();
const mockVenueFindMany = vi.fn();
const mockEstimateCount = vi.fn();
const mockDecisionFindFirst = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venueFavorite: {
      findMany: (...args: unknown[]) => mockFavoriteFindMany(...args),
    },
    visit: {
      findMany: (...args: unknown[]) => mockVisitFindMany(...args),
    },
    venue: {
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
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

import { getPreferenceVector } from "@/server/actions/preference-vector";
import { summarizePreferenceVector } from "@/lib/preference-vector-format";
import { getCoachProactiveSuggestions } from "@/server/actions/coach-suggestions";

// --- Fixtures --------------------------------------------------------------

function venue(
  id: string,
  overrides: {
    vibeTags?: string[];
    ceremonyStyles?: string[];
    location?: string | null;
    capacityMin?: number | null;
    capacityMax?: number | null;
    costMin?: number | null;
    costMax?: number | null;
    name?: string;
  } = {},
) {
  return {
    id,
    name: overrides.name ?? `式場${id.toUpperCase()}`,
    vibeTags: overrides.vibeTags ?? [],
    ceremonyStyles: overrides.ceremonyStyles ?? [],
    location: overrides.location ?? null,
    capacityMin: overrides.capacityMin ?? null,
    capacityMax: overrides.capacityMax ?? null,
    costMin: overrides.costMin ?? null,
    costMax: overrides.costMax ?? null,
  };
}

beforeEach(() => {
  mockFavoriteFindMany.mockReset();
  mockVisitFindMany.mockReset();
  mockVenueFindMany.mockReset();
  mockEstimateCount.mockReset().mockResolvedValue(0);
  mockDecisionFindFirst.mockReset().mockResolvedValue(null);
});

describe("preference vector → coach pipeline", () => {
  it("warm vector + 2 estimates triggers the 'compare top favorites' coach suggestion", async () => {
    const v1 = venue("a", {
      vibeTags: ["natural", "garden"],
      ceremonyStyles: ["chapel"],
      location: "東京都渋谷区代々木 1-2",
      capacityMin: 60,
      capacityMax: 100,
      costMin: 3_000_000,
      costMax: 4_000_000,
      name: "式場A",
    });
    const v2 = venue("b", {
      vibeTags: ["natural", "elegant"],
      ceremonyStyles: ["chapel", "shinto"],
      location: "東京都渋谷区神宮前 5-6",
      capacityMin: 80,
      capacityMax: 120,
      costMin: 3_500_000,
      costMax: 4_500_000,
      name: "式場B",
    });

    mockFavoriteFindMany.mockResolvedValue([
      { venue: v1 },
      { venue: v2 },
    ]);
    mockVisitFindMany.mockResolvedValue([]);
    mockVenueFindMany.mockResolvedValue([
      { id: v1.id, name: v1.name },
      { id: v2.id, name: v2.name },
    ]);
    mockEstimateCount.mockResolvedValue(2);

    // Step 1: behavioural vector — should be warm with both venues.
    const vector = await getPreferenceVector();
    expect(vector.cold).toBe(false);
    expect(vector.signalCount).toBe(2);
    expect(vector.topVibes).toContain("natural");

    // Step 2: prompt injection summary — non-null, contains the venue
    // counts the couple has produced. This is the string that ends up
    // appended to onboarding-recs's Claude userMessage.
    const summary = summarizePreferenceVector(vector);
    expect(summary).not.toBeNull();
    expect(summary).toContain("お気に入り");
    expect(summary).toContain("natural");

    // Step 3: coach reads the same favorite + estimate state and
    // surfaces the comparison suggestion. The chip title contains the
    // names of the top-2 favorites — same names the matrix board uses.
    const suggestions = await getCoachProactiveSuggestions();
    const compareSuggestion = suggestions.find(
      (s) => s.id === "compare-top-favorites",
    );
    expect(compareSuggestion).toBeDefined();
    expect(compareSuggestion?.title).toContain("式場A");
    expect(compareSuggestion?.title).toContain("式場B");
  });

  it("cold-start (no favorites) → vector cold:true → null summary → no coach suggestion", async () => {
    mockFavoriteFindMany.mockResolvedValue([]);
    mockVisitFindMany.mockResolvedValue([]);
    mockVenueFindMany.mockResolvedValue([]);

    const vector = await getPreferenceVector();
    expect(vector.cold).toBe(true);
    expect(vector.signalCount).toBe(0);

    // Cold vector → summarize returns null → onboarding-recs falls back
    // to declared conditions only (no behavioural prompt suffix).
    const summary = summarizePreferenceVector(vector);
    expect(summary).toBeNull();

    // Coach with 0 venues short-circuits; the surface is hidden.
    const suggestions = await getCoachProactiveSuggestions();
    expect(suggestions).toEqual([]);
  });

  it("favorites without visits triggers 'visit the favorite' coach prompt", async () => {
    const v1 = venue("a", {
      vibeTags: ["natural"],
      ceremonyStyles: ["chapel"],
      name: "式場A",
    });
    mockFavoriteFindMany.mockResolvedValue([{ venue: v1 }]);
    mockVisitFindMany.mockResolvedValue([]);
    mockVenueFindMany.mockResolvedValue([{ id: v1.id, name: v1.name }]);
    mockEstimateCount.mockResolvedValue(0);

    const suggestions = await getCoachProactiveSuggestions();
    const visitSuggestion = suggestions.find(
      (s) => s.id === "favorite-without-visit",
    );
    expect(visitSuggestion).toBeDefined();
    expect(visitSuggestion?.title).toContain("式場A");
    expect(visitSuggestion?.iconKey).toBe("calendar");
  });

  it("decision present → coach switches to countdown lane and ignores comparison", async () => {
    const v1 = venue("a", { name: "式場A" });
    mockFavoriteFindMany.mockResolvedValue([{ venue: v1 }]);
    mockVisitFindMany.mockResolvedValue([]);
    mockVenueFindMany.mockResolvedValue([{ id: v1.id, name: v1.name }]);
    mockEstimateCount.mockResolvedValue(2);
    const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    mockDecisionFindFirst.mockResolvedValue({
      venue: { name: "式場A" },
      weddingDate: futureDate,
    });

    const suggestions = await getCoachProactiveSuggestions();
    const ids = suggestions.map((s) => s.id);

    // Decided projects only get countdown + final-budget suggestions.
    expect(ids).toContain("decision-countdown");
    expect(ids).toContain("decision-budget-final");
    // Comparison suggestion must NOT appear after decision — the couple
    // already chose; surfacing 比べる reads as backwards.
    expect(ids).not.toContain("compare-top-favorites");
  });

  it("many venues + zero favorites surfaces the triage prompt", async () => {
    // 5 venues, no favorites → coach pushes "整理を手伝う".
    const venues = Array.from({ length: 5 }, (_, i) =>
      venue(`v${i}`, { name: `式場${i}` }),
    );
    mockFavoriteFindMany.mockResolvedValue([]);
    mockVisitFindMany.mockResolvedValue([]);
    mockVenueFindMany.mockResolvedValue(
      venues.map((v) => ({ id: v.id, name: v.name })),
    );
    mockEstimateCount.mockResolvedValue(0);

    const suggestions = await getCoachProactiveSuggestions();
    const triage = suggestions.find((s) => s.id === "triage-many");
    expect(triage).toBeDefined();
    expect(triage?.title).toContain("5");
  });

  it("vector signalCount grows when visits add a previously-unseen venue", async () => {
    const v1 = venue("a", { vibeTags: ["natural"] });
    const v2 = venue("b", { vibeTags: ["elegant"] });

    // 1 favorite + 1 visit on a different venue → signalCount = 2 (warm).
    mockFavoriteFindMany.mockResolvedValue([{ venue: v1 }]);
    mockVisitFindMany.mockResolvedValue([{ venue: v2 }]);

    const vector = await getPreferenceVector();
    expect(vector.cold).toBe(false);
    expect(vector.signalCount).toBe(2);
    expect(vector.topVibes).toEqual(
      expect.arrayContaining(["natural", "elegant"]),
    );
  });
});
