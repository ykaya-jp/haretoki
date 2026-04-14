"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function syncUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Normalize email to lowercase so invitations (which also lowercase the
  // invitee's email in invitePartner) match on first login regardless of
  // casing returned by the auth provider.
  const email = user.email?.toLowerCase() ?? "";

  // If a placeholder User row was pre-created by invitePartner(email) before
  // the invitee signed up, it has a generated CUID unrelated to the Supabase
  // auth user id. Reconcile by email: move the placeholder's id to the auth
  // id so ProjectMember.userId references remain intact.
  if (email) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail && existingByEmail.id !== user.id) {
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { id: user.id },
      });
    }
  }

  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email,
      name: user.user_metadata?.name ?? null,
    },
    create: {
      id: user.id,
      email,
      name: user.user_metadata?.name ?? null,
    },
  });

  return dbUser;
}

export async function getProjectForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    include: { project: true },
    orderBy: { project: { updatedAt: "desc" } },
  });

  return membership?.project ?? null;
}
