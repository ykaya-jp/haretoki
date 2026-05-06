/**
 * Integration — disagreement spotlight on /compare.
 *
 * The disagreement spotlight surfaces, for a 2-member project, the
 * dimensions where the owner and partner gave the most different
 * scores per venue. The contract:
 *
 *   1. Solo project (1 member) → returns [] silently (no surface).
 *   2. 2-member project + per-dimension visit ratings → returns top-3
 *      |owner − partner| deltas across all venues, sorted desc.
 *   3. Deltas < MIN_DELTA (1.0) are filtered out.
 *   4. Each venue contributes at most ONE row (its single max-delta
 *      dimension); a venue with 4 dimensions doesn't produce 4 rows.
 *   5. A venue rated by only one partner (no "both rated") is skipped
 *      — surfacing a half-rating as a "disagreement" would mislead.
 *
 * Tested across the actual 2-member ProjectMember + visit/rating shape
 * that hits prisma in production.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
  requireUser: vi.fn(async () => ({ id: "user-owner" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

import { getMatrixDisagreements } from "@/server/actions/disagreement-spotlight";

// --- Fixtures --------------------------------------------------------------

const TWO_MEMBERS = [
  {
    userId: "user-owner",
    user: { id: "user-owner", name: "ヨウコ", email: "yoko@example.com" },
  },
  {
    userId: "user-partner",
    user: { id: "user-partner", name: "ケン", email: "ken@example.com" },
  },
];

const SOLO_MEMBERS = [
  {
    userId: "user-owner",
    user: { id: "user-owner", name: "ヨウコ", email: "yoko@example.com" },
  },
];

function rating(
  venueId: string,
  userId: string,
  dimension: string,
  score: number,
) {
  return {
    userId,
    dimension,
    score,
    visit: { venueId },
  };
}

beforeEach(() => {
  mockProjectMemberFindMany.mockReset();
  mockVenueFindMany.mockReset();
  mockVisitRatingFindMany.mockReset().mockResolvedValue([]);
});

describe("getMatrixDisagreements", () => {
  it("returns [] silently for a solo project (1 member)", async () => {
    mockProjectMemberFindMany.mockResolvedValue(SOLO_MEMBERS);

    const result = await getMatrixDisagreements(["v1", "v2"]);

    expect(result).toEqual([]);
    // Visit ratings should not even be queried — the surface is hidden.
    expect(mockVisitRatingFindMany).not.toHaveBeenCalled();
  });

  it("returns top-3 deltas (≥ 1.0) sorted descending across 4 venues", async () => {
    mockProjectMemberFindMany.mockResolvedValue(TWO_MEMBERS);
    mockVenueFindMany.mockResolvedValue([
      { id: "v1", name: "式場A" },
      { id: "v2", name: "式場B" },
      { id: "v3", name: "式場C" },
      { id: "v4", name: "式場D" },
    ]);

    // Crafted so each venue has a clear max-delta dimension:
    //   v1: cuisine — owner 5, partner 2 → delta 3 (largest)
    //   v2: cost_contract — owner 4, partner 2 → delta 2
    //   v3: ceremony_space — owner 5, partner 3.5 → delta 1.5
    //   v4: hospitality — owner 3, partner 2.5 → delta 0.5 (filtered out)
    mockVisitRatingFindMany.mockResolvedValue([
      // v1
      rating("v1", "user-owner", "cuisine", 5),
      rating("v1", "user-partner", "cuisine", 2),
      rating("v1", "user-owner", "ceremony_space", 4),
      rating("v1", "user-partner", "ceremony_space", 4),
      // v2
      rating("v2", "user-owner", "cost_contract", 4),
      rating("v2", "user-partner", "cost_contract", 2),
      // v3
      rating("v3", "user-owner", "ceremony_space", 5),
      rating("v3", "user-partner", "ceremony_space", 3.5),
      // v4 — both rated but delta < MIN_DELTA, must be filtered.
      rating("v4", "user-owner", "hospitality", 3),
      rating("v4", "user-partner", "hospitality", 2.5),
    ]);

    const result = await getMatrixDisagreements(["v1", "v2", "v3", "v4"]);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.venueName)).toEqual(["式場A", "式場B", "式場C"]);
    expect(result.map((r) => r.delta)).toEqual([3, 2, 1.5]);
    expect(result[0].dimension).toBe("cuisine");
    expect(result[0].ownerScore).toBe(5);
    expect(result[0].partnerScore).toBe(2);
  });

  it("each venue contributes at most one row (its max-delta dimension)", async () => {
    mockProjectMemberFindMany.mockResolvedValue(TWO_MEMBERS);
    mockVenueFindMany.mockResolvedValue([{ id: "v1", name: "式場A" }]);

    // v1 has 3 dimensions with deltas: cuisine 3, cost 2, ceremony 1.5.
    // Only the largest (cuisine 3) should surface.
    mockVisitRatingFindMany.mockResolvedValue([
      rating("v1", "user-owner", "cuisine", 5),
      rating("v1", "user-partner", "cuisine", 2),
      rating("v1", "user-owner", "cost_contract", 4),
      rating("v1", "user-partner", "cost_contract", 2),
      rating("v1", "user-owner", "ceremony_space", 4.5),
      rating("v1", "user-partner", "ceremony_space", 3),
    ]);

    const result = await getMatrixDisagreements(["v1"]);

    expect(result).toHaveLength(1);
    expect(result[0].dimension).toBe("cuisine");
    expect(result[0].delta).toBe(3);
  });

  it("skips venues where only one partner rated (no 'both rated' pair)", async () => {
    mockProjectMemberFindMany.mockResolvedValue(TWO_MEMBERS);
    mockVenueFindMany.mockResolvedValue([
      { id: "v1", name: "式場A" },
      { id: "v2", name: "式場B" },
    ]);

    mockVisitRatingFindMany.mockResolvedValue([
      // v1: only owner rated — must NOT appear as a disagreement.
      rating("v1", "user-owner", "cuisine", 5),
      // v2: both rated → eligible, delta 2.5.
      rating("v2", "user-owner", "cuisine", 5),
      rating("v2", "user-partner", "cuisine", 2.5),
    ]);

    const result = await getMatrixDisagreements(["v1", "v2"]);

    expect(result).toHaveLength(1);
    expect(result[0].venueName).toBe("式場B");
  });

  it("returns [] when called with empty venueIds (early return guard)", async () => {
    const result = await getMatrixDisagreements([]);

    expect(result).toEqual([]);
    // Guard short-circuits before auth + DB.
    expect(mockProjectMemberFindMany).not.toHaveBeenCalled();
  });

  it("populates ownerName + partnerName from member.user.name with email fallback", async () => {
    // Email-only members (no display name) should still produce
    // human-readable labels — the fallback chain user.name → user.email
    // → "あなた"/"パートナー" lives inside the action.
    mockProjectMemberFindMany.mockResolvedValue([
      {
        userId: "user-owner",
        user: { id: "user-owner", name: null, email: "owner@example.com" },
      },
      {
        userId: "user-partner",
        user: { id: "user-partner", name: null, email: "partner@example.com" },
      },
    ]);
    mockVenueFindMany.mockResolvedValue([{ id: "v1", name: "式場A" }]);
    mockVisitRatingFindMany.mockResolvedValue([
      rating("v1", "user-owner", "cuisine", 5),
      rating("v1", "user-partner", "cuisine", 2),
    ]);

    const result = await getMatrixDisagreements(["v1"]);

    expect(result).toHaveLength(1);
    expect(result[0].ownerName).toBe("owner@example.com");
    expect(result[0].partnerName).toBe("partner@example.com");
  });
});
