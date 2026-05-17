import { describe, it, expect, vi, beforeEach } from "vitest";

// Server-action coverage for the Release β bulk endpoint
// `getCoupleScoresForVenues`. What we pin:
//   1. Authz — calls requireUser + requireProjectMembership before any
//      Prisma query, so an unauth caller can't fingerprint venueIds.
//   2. IDOR — venueIds belonging to another project are silently
//      filtered to `null` (no leakage of "this id exists").
//   3. N+1 — Prisma is hit O(1) times regardless of input size.
//   4. Empty input fast-path — returns {} without touching the DB.
//   5. Pure aggregation hand-off — the per-venue scoring delegates to
//      computeCoupleVenueScoresBulk; we don't re-test the math here.

const mockRequireUser = vi.fn();
const mockRequireProjectMembership = vi.fn();

const mockVenueFindMany = vi.fn();
const mockProjectMemberFindMany = vi.fn();
const mockVisitRatingFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      findMany: (...a: unknown[]) => mockVenueFindMany(...a),
    },
    projectMember: {
      findMany: (...a: unknown[]) => mockProjectMemberFindMany(...a),
    },
    visitRating: {
      findMany: (...a: unknown[]) => mockVisitRatingFindMany(...a),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: () => mockRequireUser(),
  requireProjectMembership: (uid: string) => mockRequireProjectMembership(uid),
  requireVenueAccess: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/realtime/publish", () => ({
  publishRealtimeEvent: vi.fn(),
  resolveActor: vi.fn(),
}));

// Imported AFTER mocks so the module resolves with the stubs.
import { getCoupleScoresForVenues } from "@/server/actions/ratings";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-own" });
  mockRequireProjectMembership.mockResolvedValue({ projectId: "proj-1" });
});

describe("getCoupleScoresForVenues — Release β bulk helper", () => {
  it("returns {} immediately for an empty input (no DB calls)", async () => {
    const out = await getCoupleScoresForVenues([]);
    expect(out).toEqual({});
    expect(mockVenueFindMany).not.toHaveBeenCalled();
    expect(mockVisitRatingFindMany).not.toHaveBeenCalled();
  });

  it("rejects before any DB work when requireUser throws", async () => {
    mockRequireUser.mockRejectedValueOnce(new Error("unauthenticated"));
    await expect(
      getCoupleScoresForVenues(["v1"]),
    ).rejects.toThrow(/unauthenticated/);
    expect(mockVenueFindMany).not.toHaveBeenCalled();
    expect(mockVisitRatingFindMany).not.toHaveBeenCalled();
  });

  it("returns null for venueIds that aren't in the viewer's project (silent IDOR filter)", async () => {
    // Only v1 belongs to proj-1; v-other-project is excluded by the
    // findMany WHERE clause.
    mockVenueFindMany.mockResolvedValueOnce([{ id: "v1" }]);
    mockProjectMemberFindMany.mockResolvedValueOnce([
      { userId: "user-own" },
      { userId: "user-partner" },
    ]);
    mockVisitRatingFindMany.mockResolvedValueOnce([]);

    const out = await getCoupleScoresForVenues(["v1", "v-other-project"]);
    expect(out["v1"]).not.toBeNull();
    expect(out["v-other-project"]).toBeNull();
  });

  it("hits Prisma at most 3 times regardless of venueIds count (O(1) round-trips)", async () => {
    const venueIds = Array.from({ length: 25 }).map((_, i) => `v${i}`);
    mockVenueFindMany.mockResolvedValueOnce(venueIds.map((id) => ({ id })));
    mockProjectMemberFindMany.mockResolvedValueOnce([
      { userId: "user-own" },
    ]);
    mockVisitRatingFindMany.mockResolvedValueOnce([]);

    await getCoupleScoresForVenues(venueIds);
    expect(mockVenueFindMany).toHaveBeenCalledTimes(1);
    expect(mockProjectMemberFindMany).toHaveBeenCalledTimes(1);
    expect(mockVisitRatingFindMany).toHaveBeenCalledTimes(1);
  });

  it("buckets ratings by (venueId × userId) and produces a CoupleVenueScore per allowed venue", async () => {
    mockVenueFindMany.mockResolvedValueOnce([{ id: "v1" }, { id: "v2" }]);
    mockProjectMemberFindMany.mockResolvedValueOnce([
      { userId: "user-own" },
      { userId: "user-partner" },
    ]);
    mockVisitRatingFindMany.mockResolvedValueOnce([
      // v1 — own 4 / partner 5 on cuisine; aligned, overall 4.5
      {
        userId: "user-own",
        dimension: "cuisine",
        score: 4,
        visit: { venueId: "v1" },
      },
      {
        userId: "user-partner",
        dimension: "cuisine",
        score: 5,
        visit: { venueId: "v1" },
      },
      // v2 — only own rated, overall 2.0
      {
        userId: "user-own",
        dimension: "hospitality",
        score: 2,
        visit: { venueId: "v2" },
      },
    ]);

    const out = await getCoupleScoresForVenues(["v1", "v2"]);
    expect(out.v1?.overall).toBe(4.5);
    expect(out.v2?.overall).toBe(2);
    // v1 has cosine alignment over the shared dim → fully aligned
    expect(out.v1?.alignmentBucket).toBe("aligned");
  });

  it("filters Prisma findMany WHERE clauses by the viewer's projectId + acceptedAt + non-deleted venues", async () => {
    mockVenueFindMany.mockResolvedValueOnce([]);
    // empty project — short-circuit before VisitRating fetch
    mockProjectMemberFindMany.mockResolvedValueOnce([{ userId: "user-own" }]);

    await getCoupleScoresForVenues(["v1"]);

    expect(mockVenueFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["v1"] },
          projectId: "proj-1",
          deletedAt: null,
        }),
      }),
    );
    expect(mockProjectMemberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-1",
          acceptedAt: { not: null },
        }),
      }),
    );
  });

  it("falls back to ownUserId-only fetch when the viewer has no accepted partner", async () => {
    mockVenueFindMany.mockResolvedValueOnce([{ id: "v1" }]);
    mockProjectMemberFindMany.mockResolvedValueOnce([{ userId: "user-own" }]);
    mockVisitRatingFindMany.mockResolvedValueOnce([]);

    await getCoupleScoresForVenues(["v1"]);

    expect(mockVisitRatingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { in: ["user-own"] },
        }),
      }),
    );
  });
});
