"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";

export async function syncUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email!,
      name: user.user_metadata?.name ?? null,
    },
    create: {
      id: user.id,
      email: user.email!,
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
