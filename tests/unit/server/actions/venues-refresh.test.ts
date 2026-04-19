import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Contract tests for `refreshVenueFromSource` — the R3 backfill action
 * that re-runs the URL-import pipeline for an already-tracked venue so
 * deep-extraction columns backfill when they were added after the
 * venue was originally saved.
 *
 * Happy-path exercises extract + merge + update — covered by the
 * integration suite. Here we pin the two guard clauses so they can't
 * silently regress:
 *   1. Venue outside the caller's project ⇒ "式場が見つかりません"
 *   2. Venue present but sourceUrls empty ⇒ informative refusal rather
 *      than an attempted no-op fetch that would look like a silent bug.
 */

const findFirstMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("refreshVenueFromSource — guard clauses", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
    updateMock.mockReset();
  });

  it("refuses when the venue is not in the caller's project", async () => {
    findFirstMock.mockResolvedValue(null);

    const { refreshVenueFromSource } = await import("@/server/actions/venues");
    const result = await refreshVenueFromSource("venue-1");

    expect(result).toEqual({ success: false, error: "式場が見つかりません" });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("refuses when the venue has no sourceUrls", async () => {
    findFirstMock.mockResolvedValue({
      id: "venue-1",
      projectId: "proj-1",
      sourceUrls: [],
      serviceFeeRate: null,
    });

    const { refreshVenueFromSource } = await import("@/server/actions/venues");
    const result = await refreshVenueFromSource("venue-1");

    expect(result).toEqual({
      success: false,
      error: "登録元の URL が無いため更新できません",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
