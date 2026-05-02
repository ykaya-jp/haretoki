import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Round 23 (Phase 3 wave 1.1) — viewer-aware getCoupleRatings.
 *
 * The bug this guards against: the prior `getPartnerRatings` was role-
 * keyed, so when the partner viewed the venue page their own rating
 * appeared in BOTH the "own" row (initialRatings) AND the "partner"
 * row (partnerRatings) of the UI. The new function keys on the
 * VIEWER's userId — `ownRatings` is whoever is signed in, `otherRatings`
 * is the other project member regardless of role.
 *
 * Mocks: requireUser / requireProjectMembership / requireVenueAccess
 * + prisma.projectMember.findMany / prisma.visitRating.findMany.
 * The function under test is pure logic on top of those, so the unit
 * test pins viewer-resolution behaviour without booting the DB.
 */

const requireUserMock = vi.fn();
const requireProjectMembershipMock = vi.fn();
const requireVenueAccessMock = vi.fn();
const findMembersMock = vi.fn();
const findRatingsMock = vi.fn();

vi.mock("@/server/auth", () => ({
  requireUser: () => requireUserMock(),
  requireProjectMembership: (id: string) => requireProjectMembershipMock(id),
  requireVenueAccess: (uid: string, vid: string) =>
    requireVenueAccessMock(uid, vid),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    projectMember: { findMany: (q: unknown) => findMembersMock(q) },
    visitRating: { findMany: (q: unknown) => findRatingsMock(q) },
  },
}));

const ownerMember = {
  userId: "owner-id",
  role: "owner",
  user: { id: "owner-id", name: "オーナー", email: "owner@example" },
};
const partnerMember = {
  userId: "partner-id",
  role: "partner",
  user: { id: "partner-id", name: "パートナー", email: "partner@example" },
};

const ratingsRows = [
  { userId: "owner-id", dimension: "atmosphere", score: 4 },
  { userId: "owner-id", dimension: "cuisine", score: 5 },
  { userId: "partner-id", dimension: "atmosphere", score: 3 },
  { userId: "partner-id", dimension: "cuisine", score: 4 },
];

describe("getCoupleRatings — viewer awareness", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    requireProjectMembershipMock.mockReset();
    requireVenueAccessMock.mockReset();
    findMembersMock.mockReset();
    findRatingsMock.mockReset();

    requireProjectMembershipMock.mockResolvedValue({ projectId: "p" });
    requireVenueAccessMock.mockResolvedValue({});
    findMembersMock.mockResolvedValue([ownerMember, partnerMember]);
    findRatingsMock.mockResolvedValue(ratingsRows);
  });

  it("when the OWNER views, ownRatings = owner / otherRatings = partner", async () => {
    requireUserMock.mockResolvedValue({ id: "owner-id" });
    const { getCoupleRatings } = await import("@/server/actions/ratings");
    const r = await getCoupleRatings("venue-1");
    expect(r.ownRatings?.name).toBe("オーナー");
    expect(r.ownRatings?.ratings.atmosphere).toBe(4);
    expect(r.otherRatings?.name).toBe("パートナー");
    expect(r.otherRatings?.ratings.atmosphere).toBe(3);
  });

  it("when the PARTNER views, ownRatings = partner / otherRatings = owner", async () => {
    requireUserMock.mockResolvedValue({ id: "partner-id" });
    const { getCoupleRatings } = await import("@/server/actions/ratings");
    const r = await getCoupleRatings("venue-1");
    expect(r.ownRatings?.name).toBe("パートナー");
    expect(r.ownRatings?.ratings.atmosphere).toBe(3);
    expect(r.otherRatings?.name).toBe("オーナー");
    expect(r.otherRatings?.ratings.atmosphere).toBe(4);
  });

  it("regression guard — partner viewer's own rating MUST NOT appear in otherRatings", async () => {
    // Direct reproduction of the round-23 bug: the prior
    // `getPartnerRatings` returned role=partner ratings in the
    // partnerRatings field, so a partner viewer saw their score (3) on
    // both rows. The new function keys on viewer.userId — "other" must
    // never equal "viewer".
    requireUserMock.mockResolvedValue({ id: "partner-id" });
    const { getCoupleRatings } = await import("@/server/actions/ratings");
    const r = await getCoupleRatings("venue-1");
    expect(r.ownRatings?.ratings).not.toEqual(r.otherRatings?.ratings);
    // partner's own value MUST be 3 (their actual rating), not 4 (owner's).
    expect(r.ownRatings?.ratings.atmosphere).toBe(3);
    // other's value MUST be 4 (owner's), not 3 (partner's = self).
    expect(r.otherRatings?.ratings.atmosphere).toBe(4);
  });

  it("returns null otherRatings when the project has only one member", async () => {
    findMembersMock.mockResolvedValue([ownerMember]);
    requireUserMock.mockResolvedValue({ id: "owner-id" });
    const { getCoupleRatings } = await import("@/server/actions/ratings");
    const r = await getCoupleRatings("venue-1");
    expect(r.ownRatings?.name).toBe("オーナー");
    expect(r.otherRatings).toBeNull();
  });

  it("falls back to email when the user's name is null", async () => {
    findMembersMock.mockResolvedValue([
      { ...ownerMember, user: { ...ownerMember.user, name: null } },
      partnerMember,
    ]);
    requireUserMock.mockResolvedValue({ id: "owner-id" });
    const { getCoupleRatings } = await import("@/server/actions/ratings");
    const r = await getCoupleRatings("venue-1");
    expect(r.ownRatings?.name).toBe("owner@example");
  });
});

describe("getPartnerRatings — legacy compat shape", () => {
  beforeEach(() => {
    requireUserMock.mockReset();
    requireProjectMembershipMock.mockReset();
    requireVenueAccessMock.mockReset();
    findMembersMock.mockReset();
    findRatingsMock.mockReset();

    requireProjectMembershipMock.mockResolvedValue({ projectId: "p" });
    requireVenueAccessMock.mockResolvedValue({});
    findMembersMock.mockResolvedValue([ownerMember, partnerMember]);
    findRatingsMock.mockResolvedValue(ratingsRows);
  });

  it("preserves the prior { ownerRatings, partnerRatings } shape for unmigrated callers", async () => {
    // Owner viewer — the legacy assumption ("viewer is owner") holds, so
    // the proxy gives the same answer the original function did.
    requireUserMock.mockResolvedValue({ id: "owner-id" });
    const { getPartnerRatings } = await import("@/server/actions/ratings");
    const r = await getPartnerRatings("venue-1");
    expect(r).toHaveProperty("ownerRatings");
    expect(r).toHaveProperty("partnerRatings");
    expect(r.ownerRatings?.name).toBe("オーナー");
    expect(r.partnerRatings?.name).toBe("パートナー");
  });
});
