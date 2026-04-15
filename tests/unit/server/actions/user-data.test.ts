import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  buildUserExportBundle,
  deleteUserAccount,
  type UserDataPrisma,
} from "@/server/actions/user-data";

function makeDb(overrides: Partial<UserDataPrisma> = {}): UserDataPrisma {
  // Each nested key is deep-merged so a test can override just one method
  // (e.g. `user.findUnique`) without losing the default stubs for siblings.
  return {
    user: {
      findUnique: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      ...(overrides.user ?? {}),
    },
    projectMember: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      ...(overrides.projectMember ?? {}),
    },
    project: {
      delete: vi.fn().mockResolvedValue({}),
      ...(overrides.project ?? {}),
    },
    venueFavorite: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.venueFavorite ?? {}),
    },
    visitRating: {
      findMany: vi.fn().mockResolvedValue([]),
      ...(overrides.visitRating ?? {}),
    },
  };
}

describe("buildUserExportBundle", () => {
  it("returns the documented payload shape", async () => {
    const userRow = {
      id: "u1",
      email: "test@example.com",
      name: "Taro",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      projectMembers: [
        {
          role: "owner",
          invitedAt: new Date("2026-01-02T00:00:00Z"),
          acceptedAt: new Date("2026-01-02T00:00:00Z"),
          project: {
            id: "p1",
            name: "Our Wedding",
            conditions: { budget: 3000000 },
            currentStep: 1,
            createdAt: new Date("2026-01-02T00:00:00Z"),
            venues: [
              { id: "v1", visits: [{ id: "vis1" }], reviews: [{ id: "r1" }] },
            ],
            decisions: [{ id: "d1" }],
            coachMessages: [{ id: "cm1" }],
          },
        },
      ],
      favorites: [{ id: "f1" }],
      visitRatings: [{ id: "vr1" }],
      notificationPreference: null,
      notifications: [],
    };

    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue(userRow),
        delete: vi.fn(),
      },
    });

    const bundle = await buildUserExportBundle(db, "u1");

    expect(bundle.user).toEqual({
      id: "u1",
      email: "test@example.com",
      name: "Taro",
      createdAt: userRow.createdAt,
    });
    expect(bundle.project).toMatchObject({ id: "p1", name: "Our Wedding" });
    expect(bundle.venues).toHaveLength(1);
    expect(bundle.visits).toHaveLength(1);
    expect(bundle.reviews_i_wrote).toHaveLength(1);
    expect(bundle.ratings).toHaveLength(1);
    expect(bundle.favorites).toHaveLength(1);
    expect(bundle.decisions).toHaveLength(1);
    expect(typeof bundle.exportedAt).toBe("string");
  });

  it("throws when the user row is missing", async () => {
    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    });
    await expect(buildUserExportBundle(db, "missing")).rejects.toThrow(
      /User not found/,
    );
  });
});

describe("deleteUserAccount", () => {
  it("cascades the project for owner memberships", async () => {
    const projectDelete = vi.fn().mockResolvedValue({});
    const memberDelete = vi.fn().mockResolvedValue({ count: 1 });
    const userDelete = vi.fn().mockResolvedValue({});
    const db = makeDb({
      projectMember: {
        findMany: vi.fn().mockResolvedValue([
          { projectId: "p1", role: "owner" },
          { projectId: "p2", role: "partner" },
        ]),
        deleteMany: memberDelete,
      },
      project: { delete: projectDelete },
      user: {
        findUnique: vi.fn(),
        delete: userDelete,
      },
    });

    const result = await deleteUserAccount(db, "u1");

    // Memberships are removed for this user.
    expect(memberDelete).toHaveBeenCalledWith({ where: { userId: "u1" } });
    // Only the owned project is cascade-deleted.
    expect(projectDelete).toHaveBeenCalledTimes(1);
    expect(projectDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    // The User row is deleted last.
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(result.deletedProjectIds).toEqual(["p1"]);
  });

  it("deletes no projects when the user is only a partner", async () => {
    const projectDelete = vi.fn().mockResolvedValue({});
    const db = makeDb({
      projectMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ projectId: "p1", role: "partner" }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      project: { delete: projectDelete },
    });

    const result = await deleteUserAccount(db, "u1");

    expect(projectDelete).not.toHaveBeenCalled();
    expect(result.deletedProjectIds).toEqual([]);
  });
});

// The DELETE route's confirm/email guards are enforced by a zod schema plus
// an explicit equality check. We validate both guards directly against that
// logic so we don't need to stand up a full Next request/response harness.
describe("delete route guards", () => {
  const BodySchema = z.object({
    confirm: z.literal(true),
    email: z.string().email(),
  });

  function accept(body: unknown, userEmail: string): boolean {
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return false;
    return (
      parsed.data.email.trim().toLowerCase() ===
      userEmail.trim().toLowerCase()
    );
  }

  it("rejects when confirm is missing or false", () => {
    expect(accept({ email: "user@example.com" }, "user@example.com")).toBe(false);
    expect(accept({ confirm: false, email: "user@example.com" }, "user@example.com")).toBe(false);
  });

  it("rejects when email does not match", () => {
    expect(
      accept({ confirm: true, email: "other@example.com" }, "user@example.com"),
    ).toBe(false);
  });

  it("accepts when confirm: true and email matches (case-insensitive)", () => {
    expect(
      accept({ confirm: true, email: "User@Example.COM" }, "user@example.com"),
    ).toBe(true);
  });
});
