import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Quota / rate-limit contracts. We mock @/server/db so these tests don't
 * need a real Postgres — the logic under test is the counter math + the
 * per-minute bucket roll-over, not prisma behaviour.
 */

// vi.mock is hoisted to the top of the file; variables referenced in the
// factory must also be hoisted via vi.hoisted, otherwise they're
// uninitialised at factory-call time ("Cannot access X before initialization").
const { findUniqueMock, upsertMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    apiUsageCounter: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}));

// Import AFTER vi.mock so the module resolves against the mock.
import {
  canCallPlaces,
  incrementPlacesCounter,
  checkRateLimit,
  _resetRateBuckets,
} from "@/lib/venue-search/quota";

describe("canCallPlaces", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    upsertMock.mockReset();
    process.env.PLACES_AUTOCOMPLETE_MONTHLY_CAP = "10";
  });
  afterEach(() => {
    delete process.env.PLACES_AUTOCOMPLETE_MONTHLY_CAP;
  });

  it("allows when no row exists yet (used = 0)", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const res = await canCallPlaces("p1");
    expect(res.allowed).toBe(true);
    expect(res.used).toBe(0);
    expect(res.cap).toBe(10);
  });

  it("allows when used < cap", async () => {
    findUniqueMock.mockResolvedValueOnce({
      placesAutocompleteCount: 3,
    });
    const res = await canCallPlaces("p1");
    expect(res.allowed).toBe(true);
    expect(res.used).toBe(3);
  });

  it("denies when used >= cap", async () => {
    findUniqueMock.mockResolvedValueOnce({
      placesAutocompleteCount: 10,
    });
    const res = await canCallPlaces("p1");
    expect(res.allowed).toBe(false);
  });

  it("uses default cap 3000 when env unset", async () => {
    delete process.env.PLACES_AUTOCOMPLETE_MONTHLY_CAP;
    findUniqueMock.mockResolvedValueOnce({ placesAutocompleteCount: 2999 });
    const res = await canCallPlaces("p1");
    expect(res.cap).toBe(3000);
    expect(res.allowed).toBe(true);
  });
});

describe("incrementPlacesCounter", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    upsertMock.mockResolvedValue({});
  });

  it("calls prisma upsert with the project + month key", async () => {
    await incrementPlacesCounter("p1", 1, new Date("2026-04-21T12:00:00Z").getTime());
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const arg = upsertMock.mock.calls[0][0];
    expect(arg.where.projectId_yearMonth).toEqual({
      projectId: "p1",
      yearMonth: "2026-04",
    });
    expect(arg.create.placesAutocompleteCount).toBe(1);
    expect(arg.update.placesAutocompleteCount).toEqual({ increment: 1 });
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetRateBuckets();
    process.env.NAME_SEARCH_RATE_LIMIT_PER_MIN = "3";
  });
  afterEach(() => {
    delete process.env.NAME_SEARCH_RATE_LIMIT_PER_MIN;
  });

  it("allows up to the per-minute cap then denies", () => {
    const t = Date.parse("2026-04-21T12:00:00Z");
    expect(checkRateLimit("p1", t).ok).toBe(true);
    expect(checkRateLimit("p1", t).ok).toBe(true);
    expect(checkRateLimit("p1", t).ok).toBe(true);
    expect(checkRateLimit("p1", t).ok).toBe(false);
  });

  it("resets when the minute boundary rolls over", () => {
    const t1 = Date.parse("2026-04-21T12:00:59Z");
    const t2 = Date.parse("2026-04-21T12:01:00Z");
    expect(checkRateLimit("p1", t1).ok).toBe(true);
    expect(checkRateLimit("p1", t1).ok).toBe(true);
    expect(checkRateLimit("p1", t1).ok).toBe(true);
    expect(checkRateLimit("p1", t1).ok).toBe(false);
    // New minute — bucket should reset.
    expect(checkRateLimit("p1", t2).ok).toBe(true);
  });

  it("buckets are independent per project", () => {
    const t = Date.parse("2026-04-21T12:00:00Z");
    for (let i = 0; i < 3; i++) expect(checkRateLimit("p1", t).ok).toBe(true);
    expect(checkRateLimit("p1", t).ok).toBe(false);
    // p2 still has budget.
    expect(checkRateLimit("p2", t).ok).toBe(true);
  });
});
