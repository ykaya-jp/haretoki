/**
 * Unit tests for getPreferenceVector — behavioral preference inference
 * derived from VenueFavorite + Visit aggregates.
 *
 * Focus areas:
 *   1. Cold start (signalCount < COLD_THRESHOLD=2) → cold:true short circuit
 *      with empty top-K and null ranges.
 *   2. Frequency aggregation: top-K vibe / style / area picked by descending
 *      frequency, capped at 3.
 *   3. Range averages: capacity / cost ranges = arithmetic mean over venues
 *      that have both bounds set.
 *   4. Dedupe: a venue heart-faved AND visited counts once (set semantics).
 *
 * Prisma is mocked at the module boundary so tests don't need the real DB
 * or auth layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
const mockFavoriteFindMany = vi.fn();
const mockVisitFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venueFavorite: {
      findMany: (...args: unknown[]) => mockFavoriteFindMany(...args),
    },
    visit: {
      findMany: (...args: unknown[]) => mockVisitFindMany(...args),
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

type VenueShape = {
  id: string;
  vibeTags: string[];
  ceremonyStyles: string[];
  location: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  costMin: number | null;
  costMax: number | null;
};

const venue = (id: string, overrides: Partial<VenueShape> = {}): VenueShape => ({
  id,
  vibeTags: [],
  ceremonyStyles: [],
  location: null,
  capacityMin: null,
  capacityMax: null,
  costMin: null,
  costMax: null,
  ...overrides,
});

describe("getPreferenceVector", () => {
  beforeEach(() => {
    mockFavoriteFindMany.mockReset();
    mockVisitFindMany.mockReset();
  });

  it("returns cold:true when no favorites and no visits exist", async () => {
    mockFavoriteFindMany.mockResolvedValue([]);
    mockVisitFindMany.mockResolvedValue([]);

    const result = await getPreferenceVector();

    expect(result.cold).toBe(true);
    expect(result.signalCount).toBe(0);
    expect(result.topVibes).toEqual([]);
    expect(result.topStyles).toEqual([]);
    expect(result.topAreas).toEqual([]);
    expect(result.capacityRange).toBeNull();
    expect(result.costRange).toBeNull();
  });

  it("returns cold:true when only 1 signal exists (below COLD_THRESHOLD=2)", async () => {
    mockFavoriteFindMany.mockResolvedValue([
      { venue: venue("v1", { vibeTags: ["natural"] }) },
    ]);
    mockVisitFindMany.mockResolvedValue([]);

    const result = await getPreferenceVector();

    expect(result.cold).toBe(true);
    expect(result.signalCount).toBe(1);
    expect(result.topVibes).toEqual([]);
  });

  it("aggregates topVibes top-3 by descending frequency across 3 venues", async () => {
    // natural appears 3x, elegant 2x, garden 1x, modern 1x → top-3
    // should be [natural, elegant, (garden|modern)]
    mockFavoriteFindMany.mockResolvedValue([
      {
        venue: venue("v1", {
          vibeTags: ["natural", "elegant", "garden"],
        }),
      },
      {
        venue: venue("v2", { vibeTags: ["natural", "elegant", "modern"] }),
      },
      { venue: venue("v3", { vibeTags: ["natural"] }) },
    ]);
    mockVisitFindMany.mockResolvedValue([]);

    const result = await getPreferenceVector();

    expect(result.cold).toBe(false);
    expect(result.signalCount).toBe(3);
    expect(result.topVibes).toHaveLength(3);
    expect(result.topVibes[0]).toBe("natural");
    expect(result.topVibes[1]).toBe("elegant");
    // Index 2: tied between garden / modern. Either is valid since the
    // implementation does a stable sort by count only.
    expect(["garden", "modern"]).toContain(result.topVibes[2]);
  });

  it("computes capacity / cost ranges as arithmetic mean across venues", async () => {
    mockFavoriteFindMany.mockResolvedValue([
      {
        venue: venue("v1", {
          capacityMin: 60,
          capacityMax: 100,
          costMin: 3_000_000,
          costMax: 4_000_000,
        }),
      },
      {
        venue: venue("v2", {
          capacityMin: 80,
          capacityMax: 120,
          costMin: 4_000_000,
          costMax: 5_000_000,
        }),
      },
    ]);
    mockVisitFindMany.mockResolvedValue([]);

    const result = await getPreferenceVector();

    expect(result.capacityRange).toEqual({ min: 70, max: 110 });
    expect(result.costRange).toEqual({ min: 3_500_000, max: 4_500_000 });
  });

  it("dedupes a venue that appears in both favorites and visits (counts once)", async () => {
    const v1 = venue("v1", { vibeTags: ["natural"] });
    const v2 = venue("v2", { vibeTags: ["elegant"] });

    mockFavoriteFindMany.mockResolvedValue([
      { venue: v1 },
      { venue: v2 },
    ]);
    mockVisitFindMany.mockResolvedValue([
      // v1 also visited — must NOT be counted twice in signalCount or vibe freq
      { venue: v1 },
    ]);

    const result = await getPreferenceVector();

    expect(result.signalCount).toBe(2);
    // natural was on v1 only — should appear once, not twice
    expect(result.topVibes).toEqual(
      expect.arrayContaining(["natural", "elegant"]),
    );
    expect(result.topVibes).toHaveLength(2);
  });

  it("derives topAreas from the first 6 chars of location", async () => {
    mockFavoriteFindMany.mockResolvedValue([
      { venue: venue("v1", { location: "東京都渋谷区代々木 1-2-3" }) },
      { venue: venue("v2", { location: "東京都渋谷区神宮前 4-5-6" }) },
      { venue: venue("v3", { location: "神奈川県横浜市西区 1" }) },
    ]);
    mockVisitFindMany.mockResolvedValue([]);

    const result = await getPreferenceVector();

    // first 6 chars: "東京都渋谷区" appears 2x, "神奈川県横浜" appears 1x
    expect(result.topAreas[0]).toBe("東京都渋谷区");
    expect(result.topAreas).toContain("神奈川県横浜");
  });

  it("merges visits into the venue pool when favorites empty", async () => {
    mockFavoriteFindMany.mockResolvedValue([]);
    mockVisitFindMany.mockResolvedValue([
      { venue: venue("v1", { ceremonyStyles: ["chapel"] }) },
      { venue: venue("v2", { ceremonyStyles: ["chapel", "garden"] }) },
    ]);

    const result = await getPreferenceVector();

    expect(result.cold).toBe(false);
    expect(result.signalCount).toBe(2);
    expect(result.topStyles[0]).toBe("chapel");
  });

  it("returns null capacityRange / costRange when no venue has both bounds", async () => {
    mockFavoriteFindMany.mockResolvedValue([
      { venue: venue("v1", { capacityMin: 60, capacityMax: null }) },
      { venue: venue("v2", { capacityMin: null, capacityMax: 100 }) },
    ]);
    mockVisitFindMany.mockResolvedValue([]);

    const result = await getPreferenceVector();

    expect(result.cold).toBe(false);
    expect(result.capacityRange).toBeNull();
    expect(result.costRange).toBeNull();
  });
});
