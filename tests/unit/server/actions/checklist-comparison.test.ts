import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth & db before importing the action.
vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({ projectId: "project-1" })),
}));

const findManyMock = vi.fn();
vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

import { getChecklistComparison } from "@/server/actions/checklist-comparison";

function makeVenue(
  id: string,
  name: string,
  checklist: Array<{
    item: string;
    category: string;
    status: string;
    memo?: string | null;
    photoUrls?: string[];
  }> | null,
) {
  return {
    id,
    name,
    visits: checklist
      ? [
          {
            checklist: checklist.map((c, i) => ({
              item: c.item,
              category: c.category,
              status: c.status,
              memo: c.memo ?? null,
              photoUrls: c.photoUrls ?? [],
              sortOrder: i,
            })),
          },
        ]
      : [],
  };
}

describe("getChecklistComparison", () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it("marks difference=false when both venues have same status", async () => {
    findManyMock.mockResolvedValue([
      makeVenue("v1", "式場A", [
        { item: "内装", category: "chapel", status: "yes" },
      ]),
      makeVenue("v2", "式場B", [
        { item: "内装", category: "chapel", status: "yes" },
      ]),
    ]);

    const data = await getChecklistComparison(["v1", "v2"]);
    expect(data.venueNames).toEqual(["式場A", "式場B"]);
    expect(data.categories).toHaveLength(1);
    const item = data.categories[0].items[0];
    expect(item.difference).toBe(false);
    expect(item.venues.map((v) => v.status)).toEqual(["yes", "yes"]);
  });

  it("marks difference=true when venues differ", async () => {
    findManyMock.mockResolvedValue([
      makeVenue("v1", "式場A", [
        { item: "内装", category: "chapel", status: "yes" },
      ]),
      makeVenue("v2", "式場B", [
        { item: "内装", category: "chapel", status: "no" },
      ]),
    ]);

    const data = await getChecklistComparison(["v1", "v2"]);
    const item = data.categories[0].items[0];
    expect(item.difference).toBe(true);
    expect(item.venues.map((v) => v.status)).toEqual(["yes", "no"]);
  });

  it("treats missing visit as unchecked and flags difference", async () => {
    findManyMock.mockResolvedValue([
      makeVenue("v1", "式場A", [
        { item: "内装", category: "chapel", status: "yes" },
      ]),
      makeVenue("v2", "式場B", [
        { item: "内装", category: "chapel", status: "yes" },
      ]),
      makeVenue("v3", "式場C", null), // No visit at all
    ]);

    const data = await getChecklistComparison(["v1", "v2", "v3"]);
    const item = data.categories[0].items[0];
    expect(item.venues.map((v) => v.status)).toEqual(["yes", "yes", "unchecked"]);
    expect(item.difference).toBe(true);
  });

  it("preserves venueIds order in rows and venueNames", async () => {
    // DB may return in different order than requested.
    findManyMock.mockResolvedValue([
      makeVenue("v2", "式場B", [
        { item: "x", category: "chapel", status: "no" },
      ]),
      makeVenue("v1", "式場A", [
        { item: "x", category: "chapel", status: "yes" },
      ]),
    ]);

    const data = await getChecklistComparison(["v1", "v2"]);
    expect(data.venueNames).toEqual(["式場A", "式場B"]);
    const rows = data.categories[0].items[0].venues;
    expect(rows[0].venueId).toBe("v1");
    expect(rows[0].status).toBe("yes");
    expect(rows[1].venueId).toBe("v2");
    expect(rows[1].status).toBe("no");
  });

  it("propagates hasPhotos flag from photoUrls length", async () => {
    findManyMock.mockResolvedValue([
      makeVenue("v1", "式場A", [
        {
          item: "内装",
          category: "chapel",
          status: "yes",
          photoUrls: ["https://example.com/a.jpg"],
        },
      ]),
      makeVenue("v2", "式場B", [
        { item: "内装", category: "chapel", status: "yes", photoUrls: [] },
      ]),
    ]);

    const data = await getChecklistComparison(["v1", "v2"]);
    const venues = data.categories[0].items[0].venues;
    expect(venues[0].hasPhotos).toBe(true);
    expect(venues[1].hasPhotos).toBe(false);
  });
});
