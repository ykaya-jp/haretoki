/**
 * Unit tests for getMatrixDisagreements — finds the per-venue dimension
 * with the largest |owner - partner| rating delta across the comparison
 * set.
 *
 * Constants under test:
 *   - MIN_DELTA = 1.0 (drop deltas < 1.0 as noise)
 *   - TOP_K = 3 (return only the worst 3 disagreements across venues)
 *
 * Solo projects (1 member) → silent [] return; surface hides.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
const mockProjectMemberFindMany = vi.fn();
const mockVenueFindMany = vi.fn();
const mockVisitRatingFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    projectMember: {
      findMany: (...args: unknown[]) => mockProjectMemberFindMany(...args),
    },
    venue: {
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
    },
    visitRating: {
      findMany: (...args: unknown[]) => mockVisitRatingFindMany(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "owner-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

import { getMatrixDisagreements } from "@/server/actions/disagreement-spotlight";

const couple = [
  {
    userId: "owner-1",
    user: { id: "owner-1", name: "ゆう", email: "yuu@example.com" },
  },
  {
    userId: "partner-1",
    user: { id: "partner-1", name: "あい", email: "ai@example.com" },
  },
];

describe("getMatrixDisagreements", () => {
  beforeEach(() => {
    mockProjectMemberFindMany.mockReset();
    mockVenueFindMany.mockReset();
    mockVisitRatingFindMany.mockReset();

    mockProjectMemberFindMany.mockResolvedValue(couple);
    mockVenueFindMany.mockResolvedValue([]);
    mockVisitRatingFindMany.mockResolvedValue([]);
  });

  it("returns [] when venueIds is empty (no comparison set)", async () => {
    const result = await getMatrixDisagreements([]);
    expect(result).toEqual([]);
    // Auth wasn't even hit since the empty check short-circuits
    expect(mockProjectMemberFindMany).not.toHaveBeenCalled();
  });

  it("returns [] when project has only 1 member (solo)", async () => {
    mockProjectMemberFindMany.mockResolvedValue([couple[0]]);

    const result = await getMatrixDisagreements(["v1"]);
    expect(result).toEqual([]);
  });

  it("filters out deltas < MIN_DELTA (1.0)", async () => {
    mockVenueFindMany.mockResolvedValue([{ id: "v1", name: "A 邸" }]);
    mockVisitRatingFindMany.mockResolvedValue([
      // delta = 0.5 — below MIN_DELTA, should be filtered
      {
        userId: "owner-1",
        dimension: "cuisine",
        score: 4.0,
        visit: { venueId: "v1" },
      },
      {
        userId: "partner-1",
        dimension: "cuisine",
        score: 3.5,
        visit: { venueId: "v1" },
      },
    ]);

    const result = await getMatrixDisagreements(["v1"]);
    expect(result).toEqual([]);
  });

  it("returns the disagreement when delta is exactly MIN_DELTA (≥ 1.0)", async () => {
    mockVenueFindMany.mockResolvedValue([{ id: "v1", name: "A 邸" }]);
    mockVisitRatingFindMany.mockResolvedValue([
      {
        userId: "owner-1",
        dimension: "cuisine",
        score: 4.5,
        visit: { venueId: "v1" },
      },
      {
        userId: "partner-1",
        dimension: "cuisine",
        score: 3.5,
        visit: { venueId: "v1" },
      },
    ]);

    const result = await getMatrixDisagreements(["v1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      venueId: "v1",
      venueName: "A 邸",
      dimension: "cuisine",
      dimensionLabel: "料理・飲み物",
      ownerName: "ゆう",
      ownerScore: 4.5,
      partnerName: "あい",
      partnerScore: 3.5,
      delta: 1.0,
    });
  });

  it("only considers dimensions both members rated (skip half-rated)", async () => {
    mockVenueFindMany.mockResolvedValue([{ id: "v1", name: "A 邸" }]);
    mockVisitRatingFindMany.mockResolvedValue([
      // Owner rated cuisine — partner did NOT → should be skipped
      {
        userId: "owner-1",
        dimension: "cuisine",
        score: 5.0,
        visit: { venueId: "v1" },
      },
      // Both rated hospitality with delta = 1.5 → should win
      {
        userId: "owner-1",
        dimension: "hospitality",
        score: 4.5,
        visit: { venueId: "v1" },
      },
      {
        userId: "partner-1",
        dimension: "hospitality",
        score: 3.0,
        visit: { venueId: "v1" },
      },
    ]);

    const result = await getMatrixDisagreements(["v1"]);
    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe("hospitality");
    expect(result[0].delta).toBe(1.5);
  });

  it("sorts by descending delta and caps at TOP_K (3)", async () => {
    const venues = [
      { id: "v1", name: "A" },
      { id: "v2", name: "B" },
      { id: "v3", name: "C" },
      { id: "v4", name: "D" },
    ];
    mockVenueFindMany.mockResolvedValue(venues);

    // Build ratings: deltas 1.5, 2.5, 1.2, 3.0 → expect ordering D, B, A, (C dropped)
    const ratings = [
      // v1: delta 1.5
      {
        userId: "owner-1",
        dimension: "cuisine",
        score: 4.5,
        visit: { venueId: "v1" },
      },
      {
        userId: "partner-1",
        dimension: "cuisine",
        score: 3.0,
        visit: { venueId: "v1" },
      },
      // v2: delta 2.5
      {
        userId: "owner-1",
        dimension: "hospitality",
        score: 5.0,
        visit: { venueId: "v2" },
      },
      {
        userId: "partner-1",
        dimension: "hospitality",
        score: 2.5,
        visit: { venueId: "v2" },
      },
      // v3: delta 1.2
      {
        userId: "owner-1",
        dimension: "ceremony_space",
        score: 4.2,
        visit: { venueId: "v3" },
      },
      {
        userId: "partner-1",
        dimension: "ceremony_space",
        score: 3.0,
        visit: { venueId: "v3" },
      },
      // v4: delta 3.0
      {
        userId: "owner-1",
        dimension: "cost_contract",
        score: 5.0,
        visit: { venueId: "v4" },
      },
      {
        userId: "partner-1",
        dimension: "cost_contract",
        score: 2.0,
        visit: { venueId: "v4" },
      },
    ];
    mockVisitRatingFindMany.mockResolvedValue(ratings);

    const result = await getMatrixDisagreements(["v1", "v2", "v3", "v4"]);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.venueName)).toEqual(["D", "B", "A"]);
    expect(result.map((r) => r.delta)).toEqual([3.0, 2.5, 1.5]);
  });

  it("falls back to email or 'あなた'/'パートナー' when name is null", async () => {
    mockProjectMemberFindMany.mockResolvedValue([
      {
        userId: "owner-1",
        user: { id: "owner-1", name: null, email: "yuu@example.com" },
      },
      {
        userId: "partner-1",
        user: { id: "partner-1", name: null, email: null },
      },
    ]);
    mockVenueFindMany.mockResolvedValue([{ id: "v1", name: "A 邸" }]);
    mockVisitRatingFindMany.mockResolvedValue([
      {
        userId: "owner-1",
        dimension: "cuisine",
        score: 5.0,
        visit: { venueId: "v1" },
      },
      {
        userId: "partner-1",
        dimension: "cuisine",
        score: 3.0,
        visit: { venueId: "v1" },
      },
    ]);

    const result = await getMatrixDisagreements(["v1"]);

    expect(result).toHaveLength(1);
    expect(result[0].ownerName).toBe("yuu@example.com");
    expect(result[0].partnerName).toBe("パートナー");
  });
});
