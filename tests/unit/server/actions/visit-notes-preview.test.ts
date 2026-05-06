/**
 * Unit tests for getMatrixVisitNotes.
 *
 * Focus areas:
 *   1. Empty venueIds → empty array, no DB call
 *   2. Single note per venue → excerpt at full length
 *   3. Long content (>80 chars) → truncated with ellipsis
 *   4. Multiple notes per venue → only latest returned, totalNotesAtVenue counts all
 *   5. Media attached → hasMedia: true
 *   6. visit.completedAt prefer over scheduledAt for visitDate
 *
 * prisma.visitNote is mocked at the module boundary.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockVisitNoteFindMany = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    visitNote: {
      findMany: (...args: unknown[]) => mockVisitNoteFindMany(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn().mockResolvedValue({ id: "user-1" }),
  requireProjectMembership: vi
    .fn()
    .mockResolvedValue({ projectId: "proj-1", role: "owner" }),
}));

import { getMatrixVisitNotes } from "@/server/actions/visit-notes-preview";

beforeEach(() => {
  mockVisitNoteFindMany.mockReset();
});

describe("getMatrixVisitNotes", () => {
  it("empty venueIds → returns [] without DB call", async () => {
    const result = await getMatrixVisitNotes([]);
    expect(result).toEqual([]);
    expect(mockVisitNoteFindMany).not.toHaveBeenCalled();
  });

  it("single short note → full-text excerpt, count 1", async () => {
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n1",
        content: "光が入って素敵だった",
        createdAt: new Date("2026-04-01"),
        visit: {
          venueId: "v1",
          scheduledAt: null,
          completedAt: new Date("2026-03-30"),
        },
        user: { name: "妻", email: null },
        media: [],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      venueId: "v1",
      noteId: "n1",
      excerpt: "光が入って素敵だった",
      authorName: "妻",
      hasMedia: false,
      totalNotesAtVenue: 1,
    });
    // Visit date should prefer completedAt over note createdAt
    expect(result[0].visitDate).toEqual(new Date("2026-03-30"));
  });

  it("long content (>80 chars) → truncated with ellipsis", async () => {
    const longContent = "あ".repeat(120);
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n1",
        content: longContent,
        createdAt: new Date("2026-04-01"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: null,
        media: [],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1"]);
    expect(result[0].excerpt).toHaveLength(81); // 80 chars + ellipsis
    expect(result[0].excerpt.endsWith("…")).toBe(true);
  });

  it("multiple notes per venue → latest only, totalNotesAtVenue counts all", async () => {
    // findMany sorts by createdAt desc, so first row is latest
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n3",
        content: "最新メモ",
        createdAt: new Date("2026-04-15"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: { name: "夫", email: null },
        media: [],
      },
      {
        id: "n2",
        content: "ちょっと前のメモ",
        createdAt: new Date("2026-04-10"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: { name: "妻", email: null },
        media: [],
      },
      {
        id: "n1",
        content: "最初のメモ",
        createdAt: new Date("2026-04-05"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: { name: "夫", email: null },
        media: [],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1"]);
    expect(result).toHaveLength(1);
    expect(result[0].noteId).toBe("n3"); // latest
    expect(result[0].excerpt).toBe("最新メモ");
    expect(result[0].totalNotesAtVenue).toBe(3); // count of all 3
    expect(result[0].authorName).toBe("夫");
  });

  it("note with attached media → hasMedia: true", async () => {
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n1",
        content: "写真付き",
        createdAt: new Date("2026-04-01"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: { name: "妻", email: null },
        media: [{ id: "m1" }],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1"]);
    expect(result[0].hasMedia).toBe(true);
  });

  it("multiple venues → one preview per venue", async () => {
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n1",
        content: "v1 のメモ",
        createdAt: new Date("2026-04-10"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: { name: "妻", email: null },
        media: [],
      },
      {
        id: "n2",
        content: "v2 のメモ",
        createdAt: new Date("2026-04-05"),
        visit: { venueId: "v2", scheduledAt: null, completedAt: null },
        user: { name: "夫", email: null },
        media: [],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1", "v2"]);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.venueId).sort()).toEqual(["v1", "v2"]);
  });

  it("falls back to scheduledAt when completedAt is null", async () => {
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n1",
        content: "予定だけ",
        createdAt: new Date("2026-04-15"),
        visit: {
          venueId: "v1",
          scheduledAt: new Date("2026-04-10"),
          completedAt: null,
        },
        user: { name: "妻", email: null },
        media: [],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1"]);
    expect(result[0].visitDate).toEqual(new Date("2026-04-10"));
  });

  it("user with email-only (no name) → email as authorName", async () => {
    mockVisitNoteFindMany.mockResolvedValueOnce([
      {
        id: "n1",
        content: "匿名さん",
        createdAt: new Date("2026-04-01"),
        visit: { venueId: "v1", scheduledAt: null, completedAt: null },
        user: { name: null, email: "wife@example.com" },
        media: [],
      },
    ]);

    const result = await getMatrixVisitNotes(["v1"]);
    expect(result[0].authorName).toBe("wife@example.com");
  });
});
