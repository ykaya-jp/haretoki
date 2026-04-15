// GDPR data-portability / erasure helpers.
//
// These functions are intentionally pure with respect to the Prisma client:
// the API route injects the real client, tests inject a mock. Keeps the HTTP
// layer thin and the data logic unit-testable.

// Minimal structural type — everything the two helpers below touch. We avoid
// importing the real PrismaClient so tests can pass a plain mock object.
// Arg types are `any` (not `unknown`) so that real Prisma delegate signatures
// are assignable — Prisma's generated method signatures are generic and would
// not be compatible with a stricter `unknown` arg type.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type UserDataPrisma = {
  user: {
    findUnique: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
  };
  projectMember: {
    findMany: (
      args: any,
    ) => Promise<Array<{ projectId: string; role: string }>>;
    deleteMany: (args: any) => Promise<{ count: number }>;
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
 * Permanently deletes the user and any data that becomes orphaned.
 *
 * Strategy:
 *   1. Find every project the user is a member of.
 *   2. Remove this user's `ProjectMember` rows.
 *   3. For each project where the user was an `owner`, cascade-delete the
 *      entire project. The schema's `onDelete: Cascade` on Project->Venue,
 *      Venue->Visit, etc. takes care of the transitive children.
 *   4. Delete the `User` row. Remaining user-scoped children (favorites,
 *      visit ratings, notifications, notificationPreference) cascade via the
 *      schema's `onDelete: Cascade` on the User relation.
 *
 * Returns a small summary so the route handler can log / tests can assert.
 */
export async function deleteUserAccount(
  db: UserDataPrisma,
  userId: string,
): Promise<{ deletedProjectIds: string[] }> {
  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: { projectId: true, role: true },
  });

  // Remove this user's membership rows first so that when we delete the
  // project, the FK from ProjectMember->User doesn't complicate ordering.
  await db.projectMember.deleteMany({ where: { userId } });

  const ownedProjectIds = memberships
    .filter((m) => m.role === "owner")
    .map((m) => m.projectId);

  for (const projectId of ownedProjectIds) {
    // Cascades to venues, estimates, visits, ratings, reviews, coachMessages,
    // decisions, partnerReactions, etc. via the Prisma schema.
    await db.project.delete({ where: { id: projectId } });
  }

  await db.user.delete({ where: { id: userId } });

  return { deletedProjectIds: ownedProjectIds };
}
