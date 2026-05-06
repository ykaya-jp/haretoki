/**
 * Integration — Wrapped page data aggregation.
 *
 * /wrapped is the "Spotify Wrapped 風" 5-page hero story. The page
 * stitches together venue counts, visit counts, rating counts, note
 * counts, top vibes, top areas, and the decided venue name into a
 * narrative. This file pins:
 *
 *   1. Composing all 5 underlying signals (venues + visits + ratings
 *      + notes + decision) flips hasStory to true.
 *   2. Top-K vibe / area derivation matches the same rule
 *      preference-vector uses (frequency-sorted, slice 3, location
 *      bucketed by first 6 chars).
 *   3. Empty project (no venues, no decision) returns hasStory:false
 *      — drives the zero-state copy on /wrapped.
 *   4. venuesEngaged < venuesAdded when some venues have neither
 *      favorite nor visit (= imported but never engaged with).
 *   5. The Decision lookup feeds decidedVenueName independently of
 *      the visit / rating counts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockProjectFindUnique = vi.fn();
const mockVenueFindMany = vi.fn();
const mockVisitCount = vi.fn();
const mockVisitRatingCount = vi.fn();
const mockVisitNoteCount = vi.fn();
const mockDecisionFindFirst = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    project: {
      findUnique: (...args: unknown[]) => mockProjectFindUnique(...args),
    },
    venue: {
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
    },
    visit: {
      count: (...args: unknown[]) => mockVisitCount(...args),
    },
    visitRating: {
      count: (...args: unknown[]) => mockVisitRatingCount(...args),
    },
    visitNote: {
      count: (...args: unknown[]) => mockVisitNoteCount(...args),
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

import { getWrappedData } from "@/server/actions/wrapped";

function venueRow(
  id: string,
  overrides: {
    vibeTags?: string[];
    location?: string | null;
    favorited?: boolean;
    visited?: boolean;
  } = {},
) {
  return {
    id,
    vibeTags: overrides.vibeTags ?? [],
    location: overrides.location ?? null,
    favorites: overrides.favorited ? [{ id: "f1" }] : [],
    visits: overrides.visited ? [{ id: "v1" }] : [],
  };
}

beforeEach(() => {
  mockProjectFindUnique.mockReset().mockResolvedValue({
    id: "proj-1",
    createdAt: new Date("2026-01-01"),
    name: "二人の式場さがし",
  });
  mockVenueFindMany.mockReset();
  mockVisitCount.mockReset().mockResolvedValue(0);
  mockVisitRatingCount.mockReset().mockResolvedValue(0);
  mockVisitNoteCount.mockReset().mockResolvedValue(0);
  mockDecisionFindFirst.mockReset().mockResolvedValue(null);
});

describe("getWrappedData — story aggregation", () => {
  it("composes 5 signals (venues + visits + ratings + notes + decision) into hasStory:true", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", {
        vibeTags: ["natural", "garden"],
        location: "東京都渋谷区代々木 1-2",
        favorited: true,
        visited: true,
      }),
      venueRow("v2", {
        vibeTags: ["natural", "elegant"],
        location: "東京都渋谷区神宮前 5-6",
        favorited: true,
        visited: false,
      }),
      venueRow("v3", {
        vibeTags: ["modern"],
        location: "神奈川県横浜市西区 1-2",
        favorited: false,
        visited: true,
      }),
    ]);
    mockVisitCount.mockResolvedValue(2);
    mockVisitRatingCount.mockResolvedValue(7);
    mockVisitNoteCount.mockResolvedValue(3);
    mockDecisionFindFirst.mockResolvedValue({
      venue: { name: "式場A" },
    });

    const data = await getWrappedData();

    expect(data.hasStory).toBe(true);
    expect(data.venuesAdded).toBe(3);
    // All 3 venues have either a favorite or a visit → all engaged.
    expect(data.venuesEngaged).toBe(3);
    expect(data.visitsCompleted).toBe(2);
    expect(data.ratingsRecorded).toBe(7);
    expect(data.notesWritten).toBe(3);
    expect(data.decidedVenueName).toBe("式場A");
    expect(data.projectName).toBe("二人の式場さがし");
  });

  it("derives topVibes / topAreas with the same first-6-char + frequency rule", async () => {
    // natural: 3, elegant: 2, modern: 1, garden: 1
    // 東京都渋谷区: 2, 神奈川県横浜: 1
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", {
        vibeTags: ["natural", "garden"],
        location: "東京都渋谷区代々木 1-2",
        favorited: true,
      }),
      venueRow("v2", {
        vibeTags: ["natural", "elegant"],
        location: "東京都渋谷区神宮前 5-6",
        favorited: true,
      }),
      venueRow("v3", {
        vibeTags: ["natural", "elegant", "modern"],
        location: "神奈川県横浜市西区 1-2",
        favorited: true,
      }),
    ]);

    const data = await getWrappedData();

    expect(data.topVibes[0]).toBe("natural");
    expect(data.topVibes).toContain("elegant");
    expect(data.topVibes).toHaveLength(3);

    expect(data.topAreas[0]).toBe("東京都渋谷区");
    expect(data.topAreas).toContain("神奈川県横浜");
  });

  it("empty project (no venues + no decision) → hasStory:false", async () => {
    mockVenueFindMany.mockResolvedValue([]);

    const data = await getWrappedData();

    expect(data.hasStory).toBe(false);
    expect(data.venuesAdded).toBe(0);
    expect(data.venuesEngaged).toBe(0);
    expect(data.topVibes).toEqual([]);
    expect(data.topAreas).toEqual([]);
    expect(data.decidedVenueName).toBeNull();
  });

  it("venuesEngaged is strictly venues with favorite OR visit (imported-only excluded)", async () => {
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", { favorited: true, visited: false }),
      venueRow("v2", { favorited: false, visited: true }),
      // Imported but never hearted or visited — must NOT count toward engaged.
      venueRow("v3", { favorited: false, visited: false }),
    ]);

    const data = await getWrappedData();

    expect(data.venuesAdded).toBe(3);
    expect(data.venuesEngaged).toBe(2);
  });

  it("decision alone (no venues / visits / ratings) flips hasStory:true", async () => {
    mockVenueFindMany.mockResolvedValue([]);
    mockDecisionFindFirst.mockResolvedValue({ venue: { name: "式場A" } });

    const data = await getWrappedData();

    expect(data.hasStory).toBe(true);
    expect(data.decidedVenueName).toBe("式場A");
    expect(data.venuesAdded).toBe(0);
  });

  it("falls back to default project name when project record is missing", async () => {
    // Edge case the helper guards: project lookup returns null
    // (race / deletion mid-request). Wrapped should still render with
    // a generic name instead of crashing.
    mockProjectFindUnique.mockResolvedValue(null);
    mockVenueFindMany.mockResolvedValue([
      venueRow("v1", { favorited: true }),
    ]);

    const data = await getWrappedData();

    expect(data.projectName).toBe("おふたり");
    expect(data.startedAt).toBeInstanceOf(Date);
  });
});
