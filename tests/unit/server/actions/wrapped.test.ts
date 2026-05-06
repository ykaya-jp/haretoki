/**
 * Unit tests for getWrappedData — Spotify Wrapped 風の集計シェイプ。
 *
 * Focus areas:
 *   1. Zero state → hasStory:false (wrapped page shows "はじまったばかり").
 *   2. Even 1 venue triggers hasStory:true (any positive signal counts).
 *   3. Decision present → decidedVenueName populated from related venue.
 *   4. topVibes / topAreas frequency aggregation top-3.
 *   5. visitsCompleted / ratingsRecorded / notesWritten passed through
 *      from prisma count() returns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
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

const STARTED = new Date("2025-10-01T00:00:00Z");

describe("getWrappedData", () => {
  beforeEach(() => {
    mockProjectFindUnique.mockReset();
    mockVenueFindMany.mockReset();
    mockVisitCount.mockReset();
    mockVisitRatingCount.mockReset();
    mockVisitNoteCount.mockReset();
    mockDecisionFindFirst.mockReset();

    mockProjectFindUnique.mockResolvedValue({
      id: "proj-1",
      createdAt: STARTED,
      name: "晴れの日プロジェクト",
    });
    mockVenueFindMany.mockResolvedValue([]);
    mockVisitCount.mockResolvedValue(0);
    mockVisitRatingCount.mockResolvedValue(0);
    mockVisitNoteCount.mockResolvedValue(0);
    mockDecisionFindFirst.mockResolvedValue(null);
  });

  it("returns hasStory:false when no venues, visits, ratings, notes, decision", async () => {
    const result = await getWrappedData();

    expect(result.hasStory).toBe(false);
    expect(result.venuesAdded).toBe(0);
    expect(result.venuesEngaged).toBe(0);
    expect(result.visitsCompleted).toBe(0);
    expect(result.ratingsRecorded).toBe(0);
    expect(result.notesWritten).toBe(0);
    expect(result.decidedVenueName).toBeNull();
    expect(result.topVibes).toEqual([]);
    expect(result.topAreas).toEqual([]);
    expect(result.projectName).toBe("晴れの日プロジェクト");
  });

  it("returns hasStory:true once at least 1 venue is added", async () => {
    mockVenueFindMany.mockResolvedValue([
      {
        id: "v1",
        vibeTags: [],
        location: null,
        favorites: [],
        visits: [],
      },
    ]);

    const result = await getWrappedData();

    expect(result.hasStory).toBe(true);
    expect(result.venuesAdded).toBe(1);
    expect(result.venuesEngaged).toBe(0);
  });

  it("counts venuesEngaged when a venue has favorite OR visit", async () => {
    mockVenueFindMany.mockResolvedValue([
      {
        id: "v1",
        vibeTags: [],
        location: null,
        favorites: [{ id: "f1" }],
        visits: [],
      },
      {
        id: "v2",
        vibeTags: [],
        location: null,
        favorites: [],
        visits: [{ id: "vis1" }],
      },
      {
        id: "v3",
        vibeTags: [],
        location: null,
        favorites: [],
        visits: [],
      },
    ]);

    const result = await getWrappedData();

    expect(result.venuesAdded).toBe(3);
    expect(result.venuesEngaged).toBe(2);
  });

  it("populates decidedVenueName from related venue when decision exists", async () => {
    mockDecisionFindFirst.mockResolvedValue({
      venue: { name: "晴海ガーデンチャペル" },
    });

    const result = await getWrappedData();

    expect(result.hasStory).toBe(true);
    expect(result.decidedVenueName).toBe("晴海ガーデンチャペル");
  });

  it("aggregates topVibes / topAreas top-3 by frequency", async () => {
    mockVenueFindMany.mockResolvedValue([
      {
        id: "v1",
        vibeTags: ["natural", "elegant"],
        location: "東京都渋谷区代々木 1",
        favorites: [],
        visits: [],
      },
      {
        id: "v2",
        vibeTags: ["natural", "modern"],
        location: "東京都渋谷区神宮前 2",
        favorites: [],
        visits: [],
      },
      {
        id: "v3",
        vibeTags: ["natural", "garden"],
        location: "神奈川県横浜市西区",
        favorites: [],
        visits: [],
      },
    ]);

    const result = await getWrappedData();

    expect(result.topVibes[0]).toBe("natural"); // freq 3
    expect(result.topVibes).toHaveLength(3);
    expect(result.topAreas[0]).toBe("東京都渋谷区"); // freq 2
    expect(result.topAreas).toContain("神奈川県横浜");
  });

  it("falls back to 'おふたり' when project has no name", async () => {
    mockProjectFindUnique.mockResolvedValue({
      id: "proj-1",
      createdAt: STARTED,
      name: null,
    });

    const result = await getWrappedData();
    expect(result.projectName).toBe("おふたり");
  });

  it("passes through count() values for visits / ratings / notes", async () => {
    mockVenueFindMany.mockResolvedValue([]);
    mockVisitCount.mockResolvedValue(4);
    mockVisitRatingCount.mockResolvedValue(11);
    mockVisitNoteCount.mockResolvedValue(7);

    const result = await getWrappedData();

    expect(result.visitsCompleted).toBe(4);
    expect(result.ratingsRecorded).toBe(11);
    expect(result.notesWritten).toBe(7);
    expect(result.hasStory).toBe(true);
  });
});
