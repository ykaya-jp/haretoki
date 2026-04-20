/**
 * One-shot data migration: consolidate placeholder User rows created by
 * invitePartner with the real Supabase auth users after they signed up.
 *
 * Background: invitePartner creates a User row with just the email so the
 * ProjectMember FK has somewhere to point. When the partner later signs
 * up via Supabase auth they get a new uuid, and the old getOrCreateProject
 * tried to do `user.update({ id: new_id })` which either silently broke
 * the FK or swapped the id — but never updated the dependent ProjectMember
 * rows consistently. Result: post-partner-link, the invitee showed up on
 * a parallel empty owner project and couldn't see the inviter's venues.
 *
 * This script finds every pair of (placeholder_user, real_user) sharing
 * an email and migrates the placeholder's FK children over to the real
 * row before deleting the placeholder. Idempotent — safe to run multiple
 * times; only acts when both rows exist.
 *
 * Run: `npx tsx scripts/migrate-placeholder-users.ts`
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL must be set");
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter } as never);

  try {
    // Supabase auth users — the source of truth for a real account.
    const { data: authUsers, error } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    if (error) throw error;
    console.log(`[migrate] found ${authUsers.users.length} Supabase auth users`);

    // Map email → auth uuid so we can match placeholders.
    const emailToAuthId = new Map<string, string>();
    for (const u of authUsers.users) {
      if (!u.email) continue;
      emailToAuthId.set(u.email.toLowerCase(), u.id);
    }

    // Prisma User rows — the candidates for migration.
    const prismaUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true },
    });
    console.log(`[migrate] found ${prismaUsers.length} Prisma users`);

    // Group Prisma users by lowercase email so we can spot duplicates.
    const byEmail = new Map<
      string,
      { id: string; email: string; name: string | null }[]
    >();
    for (const u of prismaUsers) {
      if (!u.email) continue;
      const key = u.email.toLowerCase();
      const list = byEmail.get(key) ?? [];
      list.push(u);
      byEmail.set(key, list);
    }

    let migrated = 0;
    for (const [email, rows] of byEmail) {
      const authId = emailToAuthId.get(email);
      if (!authId) {
        // No real Supabase auth user yet → leave placeholder alone (they
        // may sign up later; getOrCreateProject will handle it then).
        continue;
      }

      // Identify which row is the real one. Prefer the row whose id
      // matches the Supabase uuid; everything else under the same email
      // is a placeholder that should be collapsed into it.
      const real = rows.find((r) => r.id === authId);
      const placeholders = rows.filter((r) => r.id !== authId);
      if (placeholders.length === 0) continue; // nothing to migrate

      // If the real row doesn't exist yet, create it and then migrate.
      // This happens when the partner signed up but never visited
      // `/home` (which is what triggers getOrCreateProject).
      if (!real) {
        console.log(
          `[migrate] ${email}: no real user row yet, creating and migrating ${placeholders.length} placeholder(s)`,
        );
        await prisma.user.create({
          data: {
            id: authId,
            email,
            name: placeholders[0].name,
          },
        });
      } else {
        console.log(
          `[migrate] ${email}: consolidating ${placeholders.length} placeholder(s) into ${authId.slice(0, 8)}…`,
        );
      }

      for (const p of placeholders) {
        await prisma.$transaction(async (tx) => {
          await tx.projectMember.updateMany({
            where: { userId: p.id },
            data: { userId: authId },
          });
          await tx.venueFavorite.updateMany({
            where: { userId: p.id },
            data: { userId: authId },
          });
          await tx.visitRating.updateMany({
            where: { userId: p.id },
            data: { userId: authId },
          });
          await tx.user.delete({ where: { id: p.id } });
        });
        migrated++;
      }
    }

    console.log(`[migrate] done — migrated ${migrated} placeholder row(s)`);

    // Sanity report: print every partner ProjectMember so the operator
    // can eyeball that memberships now point at real auth users.
    const partners = await prisma.projectMember.findMany({
      where: { role: "partner" },
      include: {
        user: { select: { email: true, id: true } },
        project: { select: { name: true } },
      },
    });
    console.log(`\n[report] ${partners.length} partner membership(s):`);
    for (const p of partners) {
      const isAuth = emailToAuthId.get((p.user.email ?? "").toLowerCase());
      const status =
        isAuth === p.userId ? "✓ linked" : isAuth ? "✗ mismatch" : "(pending)";
      console.log(
        `  ${status}  ${p.user.email} · project="${p.project.name}" · accepted=${p.acceptedAt !== null}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
