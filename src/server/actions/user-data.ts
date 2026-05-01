// GDPR data-portability / erasure helpers.
//
// These functions are intentionally pure with respect to the Prisma client:
// the API route injects the real client, tests inject a mock. Keeps the HTTP
// layer thin and the data logic unit-testable.

import { createHash, randomBytes } from "crypto";

// Minimal structural type — everything the helpers below touch. We avoid
// importing the real PrismaClient so tests can pass a plain mock object.
// Arg types are `any` (not `unknown`) so that real Prisma delegate signatures
// are assignable — Prisma's generated method signatures are generic and would
// not be compatible with a stricter `unknown` arg type.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type UserDataPrisma = {
  user: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  projectMember: {
    findMany: (
      args: any,
    ) => Promise<Array<{ projectId: string; role: string }>>;
    deleteMany: (args: any) => Promise<{ count: number }>;
    count: (args: any) => Promise<number>;
  };
  project: {
    delete: (args: any) => Promise<any>;
  };
  venueFavorite: {
    findMany: (args: any) => Promise<any[]>;
  };
  visitRating: {
    findMany: (args: any) => Promise<any[]>;
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Builds the export payload for a single user. The bundle includes the user's
 * profile plus the project they belong to (with all venues/visits/reviews/
 * ratings/favorites/decisions). If the user belongs to multiple projects
 * (partner-of-partner edge cases) we include all of them.
 */
export async function buildUserExportBundle(
  db: UserDataPrisma,
  userId: string,
) {
  const user = (await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      projectMembers: {
        select: {
          role: true,
          invitedAt: true,
          acceptedAt: true,
          project: {
            select: {
              id: true,
              name: true,
              conditions: true,
              currentStep: true,
              createdAt: true,
              venues: {
                include: {
                  scores: true,
                  estimates: { include: { items: true } },
                  visits: {
                    include: {
                      checklist: true,
                      notes: { include: { media: true } },
                      ratings: true,
                    },
                  },
                  reviews: true,
                  plans: true,
                  decision: true,
                  favorites: true,
                },
              },
              decisions: true,
              coachMessages: true,
            },
          },
        },
      },
      favorites: { include: { venue: { select: { id: true, name: true } } } },
      visitRatings: true,
      notificationPreference: true,
      notifications: true,
    },
  })) as {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
    projectMembers: Array<{
      role: string;
      invitedAt: Date;
      acceptedAt: Date | null;
      project: {
        id: string;
        name: string;
        conditions: unknown;
        currentStep: number;
        createdAt: Date;
        venues: unknown[];
        decisions: unknown[];
        coachMessages: unknown[];
      };
    }>;
    favorites: unknown[];
    visitRatings: unknown[];
    notificationPreference: unknown;
    notifications: unknown[];
  } | null;

  if (!user) {
    throw new Error("User not found");
  }

  const projects = user.projectMembers.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    conditions: m.project.conditions,
    currentStep: m.project.currentStep,
    createdAt: m.project.createdAt,
    role: m.role,
    invitedAt: m.invitedAt,
    acceptedAt: m.acceptedAt,
  }));

  const venues = user.projectMembers.flatMap((m) =>
    (m.project.venues as Array<{ visits?: unknown[]; reviews?: unknown[]; decision?: unknown; favorites?: unknown[] }>),
  );

  const visits = venues.flatMap(
    (v) => ((v as { visits?: unknown[] }).visits ?? []) as unknown[],
  );
  const reviews = venues.flatMap(
    (v) => ((v as { reviews?: unknown[] }).reviews ?? []) as unknown[],
  );
  const decisions = user.projectMembers.flatMap((m) => m.project.decisions);
  const coachMessages = user.projectMembers.flatMap(
    (m) => m.project.coachMessages,
  );

  return {
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    // `project` (singular) is the primary one — keep the documented shape —
    // and `projects` (plural) carries any additional memberships.
    project: projects[0] ?? null,
    projects,
    venues,
    visits,
    reviews_i_wrote: reviews,
    ratings: user.visitRatings,
    favorites: user.favorites,
    decisions,
    coachMessages,
    notificationPreference: user.notificationPreference,
    notifications: user.notifications,
  };
}

/**
 * Collect every photo/media URL referenced by the export bundle, so the
 * ZIP packaging can include a `photos/manifest.txt` that points users
 * at the actual files in Supabase Storage. We don't download the
 * binaries here (that would 10x the bundle size and slow the export
 * dramatically) — the manifest is enough for "can I retrieve my data"
 * compliance.
 */
export function collectPhotoUrls(
  bundle: Awaited<ReturnType<typeof buildUserExportBundle>>,
): string[] {
  const urls = new Set<string>();
  const venues = (bundle.venues ?? []) as Array<{
    photoUrls?: string[] | null;
    visits?: Array<{
      checklist?: Array<{ photoUrls?: string[] | null }>;
      notes?: Array<{ media?: Array<{ mediaUrl?: string | null }> }>;
    }>;
  }>;
  for (const v of venues) {
    for (const u of v.photoUrls ?? []) urls.add(u);
    for (const visit of v.visits ?? []) {
      for (const item of visit.checklist ?? []) {
        for (const u of item.photoUrls ?? []) urls.add(u);
      }
      for (const note of visit.notes ?? []) {
        for (const media of note.media ?? []) {
          if (media.mediaUrl) urls.add(media.mediaUrl);
        }
      }
    }
  }
  return Array.from(urls).sort();
}

/**
 * GDPR-light account erasure.
 *
 * The original (pre-round-15) implementation cascade-deleted every
 * project the user owned. That was correct for the single-tenant case
 * but wrong when a partner had been invited and is still using the
 * project — their data would silently disappear with the owner's
 * delete. The new flow:
 *
 *   1. For projects with OTHER accepted members:
 *      - Drop this user's ProjectMember row
 *      - Project + its data survives (the partner becomes the sole
 *        remaining member; ownership transfer is a separate concern
 *        we don't auto-resolve here — partner just has fewer rights
 *        until they explicitly take ownership)
 *      - The owning user's personal-data children (favorites, visit
 *        ratings, visit notes authored by them) cascade via the
 *        schema's onDelete:Cascade on User
 *   2. For projects where this user was the SOLE member: cascade-
 *      delete the project (legacy behaviour).
 *   3. Anonymise the User row BEFORE deletion: email → hash, name →
 *      null. This is belt-and-braces — `prisma.user.delete()` will
 *      hard-delete the row and cascade. The two-step (anonymise
 *      then delete) protects against half-completed deletes leaving
 *      identifying info around if a step throws midway.
 *   4. Delete the User row.
 *
 * Returns a structured summary so the route handler can log + the
 * audit trail can be precise.
 */
export interface DeleteUserResult {
  deletedProjectIds: string[];
  detachedProjectIds: string[];
  emailHash: string;
}

export async function deleteUserAccount(
  db: UserDataPrisma,
  userId: string,
): Promise<DeleteUserResult> {
  // Snapshot for the audit log + anonymisation step. Done before any
  // mutation so a partial failure leaves a recoverable trail.
  const snapshot = (await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })) as { email: string | null } | null;
  const emailHash = createHash("sha256")
    .update((snapshot?.email ?? "").toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);

  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true },
  });

  // Decide per project whether to cascade-delete or just detach the
  // user. Run BEFORE deleting any membership rows so the count is
  // accurate (we count "other" members, excluding the deleting user).
  const decisions = await Promise.all(
    memberships.map(async (m) => {
      const otherCount = await db.projectMember.count({
        where: { projectId: m.projectId, NOT: { userId } },
      });
      return { ...m, hasOthers: otherCount > 0 };
    }),
  );

  // Remove this user's membership rows first. After this point the
  // project FK from ProjectMember -> User no longer needs reordering.
  await db.projectMember.deleteMany({ where: { userId } });

  const deletedProjectIds: string[] = [];
  const detachedProjectIds: string[] = [];

  for (const m of decisions) {
    if (m.hasOthers) {
      // Partner / other member is still around — leave the project
      // alive. The owning user is now off the project membership; the
      // partner retains access to all shared data (venues / visits /
      // estimates / decisions). The owning user's personal-data rows
      // (favorites, ratings, notes authored by them) cascade away
      // through the User delete below.
      detachedProjectIds.push(m.projectId);
      continue;
    }
    // Sole member: cascade-delete the project (cascades to venues,
    // estimates, visits, ratings, reviews, coachMessages, decisions,
    // partnerReactions, etc. via the Prisma schema).
    await db.project.delete({ where: { id: m.projectId } });
    deletedProjectIds.push(m.projectId);
  }

  // Anonymise email + name before delete. Defence-in-depth: even if
  // the subsequent delete throws, the row no longer carries PII.
  // Use a random suffix on the anonymised email so the @unique index
  // doesn't collide with another user who already deleted today.
  const randomSuffix = randomBytes(8).toString("hex");
  await db.user.update({
    where: { id: userId },
    data: {
      email: `deleted-${emailHash}-${randomSuffix}@haretoki.deleted`,
      name: null,
    },
  });

  await db.user.delete({ where: { id: userId } });

  return { deletedProjectIds, detachedProjectIds, emailHash };
}
