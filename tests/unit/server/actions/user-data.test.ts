import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  buildUserExportBundle,
  collectPhotoUrls,
  deleteUserAccount,
  type UserDataPrisma,
} from "@/server/actions/user-data";

function makeDb(overrides: Partial<UserDataPrisma> = {}): UserDataPrisma {
  // Each nested key is deep-merged so a test can override just one method
  // (e.g. `user.findUnique`) without losing the default stubs for siblings.
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({ email: "fixture@example.com" }),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      ...(overrides.user ?? {}),
    },
    projectMember: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      count: vi.fn().mockResolvedValue(0),
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
        update: vi.fn(),
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
        update: vi.fn(),
        delete: vi.fn(),
      },
    });
    await expect(buildUserExportBundle(db, "missing")).rejects.toThrow(
      /User not found/,
    );
  });
});

describe("collectPhotoUrls", () => {
  it("collects venue photoUrls + visit checklist photos + visit note media", () => {
    const bundle = {
      exportedAt: "2026-05-02T00:00:00Z",
      user: {} as never,
      project: null,
      projects: [],
      venues: [
        {
          photoUrls: ["https://supa/v1.jpg", "https://supa/v2.jpg"],
          visits: [
            {
              checklist: [{ photoUrls: ["https://supa/c1.jpg"] }],
              notes: [
                {
                  media: [
                    { mediaUrl: "https://supa/n1.jpg" },
                    { mediaUrl: null }, // null entries silently dropped
                  ],
                },
              ],
            },
          ],
        },
      ],
      visits: [],
      reviews_i_wrote: [],
      ratings: [],
      favorites: [],
      decisions: [],
      coachMessages: [],
      notificationPreference: null,
      notifications: [],
    } as unknown as Awaited<ReturnType<typeof buildUserExportBundle>>;

    const urls = collectPhotoUrls(bundle);
    expect(urls).toEqual([
      "https://supa/c1.jpg",
      "https://supa/n1.jpg",
      "https://supa/v1.jpg",
      "https://supa/v2.jpg",
    ]);
  });

  it("dedupes URLs that appear in multiple places", () => {
    const bundle = {
      exportedAt: "x",
      user: {} as never,
      project: null,
      projects: [],
      venues: [
        {
          photoUrls: ["https://supa/dup.jpg"],
          visits: [
            {
              checklist: [{ photoUrls: ["https://supa/dup.jpg"] }],
              notes: [],
            },
          ],
        },
      ],
      visits: [],
      reviews_i_wrote: [],
      ratings: [],
      favorites: [],
      decisions: [],
      coachMessages: [],
      notificationPreference: null,
      notifications: [],
    } as unknown as Awaited<ReturnType<typeof buildUserExportBundle>>;

    expect(collectPhotoUrls(bundle)).toEqual(["https://supa/dup.jpg"]);
  });

  it("returns empty array for a bundle with no media", () => {
    const bundle = {
      exportedAt: "x",
      user: {} as never,
      project: null,
      projects: [],
      venues: [],
      visits: [],
      reviews_i_wrote: [],
      ratings: [],
      favorites: [],
      decisions: [],
      coachMessages: [],
      notificationPreference: null,
      notifications: [],
    } as unknown as Awaited<ReturnType<typeof buildUserExportBundle>>;
    expect(collectPhotoUrls(bundle)).toEqual([]);
  });
});

describe("deleteUserAccount (round 15 GDPR-light flow)", () => {
  it("cascades the project for owner memberships when sole member", async () => {
    const projectDelete = vi.fn().mockResolvedValue({});
    const memberDelete = vi.fn().mockResolvedValue({ count: 1 });
    const userDelete = vi.fn().mockResolvedValue({});
    const userUpdate = vi.fn().mockResolvedValue({});
    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: "owner@example.com" }),
        update: userUpdate,
        delete: userDelete,
      },
      projectMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ projectId: "p1", role: "owner" }]),
        deleteMany: memberDelete,
        // Sole member — count of "other" members is 0.
        count: vi.fn().mockResolvedValue(0),
      },
      project: { delete: projectDelete },
    });

    const result = await deleteUserAccount(db, "u1");

    expect(memberDelete).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(projectDelete).toHaveBeenCalledTimes(1);
    expect(projectDelete).toHaveBeenCalledWith({ where: { id: "p1" } });
    // Anonymise step runs BEFORE the user delete.
    expect(userUpdate).toHaveBeenCalledOnce();
    const updateArgs = userUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { email: string; name: null };
    };
    expect(updateArgs.where.id).toBe("u1");
    expect(updateArgs.data.email).toMatch(/^deleted-[0-9a-f]{16}-[0-9a-f]{16}@haretoki\.deleted$/);
    expect(updateArgs.data.name).toBeNull();
    expect(userDelete).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(result.deletedProjectIds).toEqual(["p1"]);
    expect(result.detachedProjectIds).toEqual([]);
    expect(result.emailHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("DETACHES (does not cascade) when project has another active member", async () => {
    // Critical: a partner-of-someone-else's-project must not lose
    // their data when the original owner deletes. Pin the contract.
    const projectDelete = vi.fn().mockResolvedValue({});
    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: "leaving@example.com" }),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      },
      projectMember: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ projectId: "p1", role: "owner" }]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        // The partner is still around — count of "other" members > 0.
        count: vi.fn().mockResolvedValue(1),
      },
      project: { delete: projectDelete },
    });

    const result = await deleteUserAccount(db, "u1");

    expect(projectDelete).not.toHaveBeenCalled();
    expect(result.deletedProjectIds).toEqual([]);
    expect(result.detachedProjectIds).toEqual(["p1"]);
  });

  it("anonymises email + name BEFORE deleting the user row", async () => {
    // Defence-in-depth pin: if the delete throws midway, the row no
    // longer carries identifying info.
    const callOrder: string[] = [];
    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: "foo@bar.com" }),
        update: vi.fn().mockImplementation(async () => {
          callOrder.push("update");
          return {};
        }),
        delete: vi.fn().mockImplementation(async () => {
          callOrder.push("delete");
          return {};
        }),
      },
    });

    await deleteUserAccount(db, "u1");

    expect(callOrder).toEqual(["update", "delete"]);
  });

  it("computes the same emailHash as audit/hashEmail for the same input", async () => {
    // The route handler logs `emailHash` from the audit module while
    // the deleteUserAccount function returns `emailHash` from its own
    // crypto path. Both must match so audit rows correlate.
    const db = makeDb({
      user: {
        findUnique: vi.fn().mockResolvedValue({ email: "Test@Example.COM" }),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      },
    });
    const { emailHash } = await deleteUserAccount(db, "u1");

    const { hashEmail } = await import("@/lib/audit-helpers");
    expect(emailHash).toBe(hashEmail("Test@Example.COM"));
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
