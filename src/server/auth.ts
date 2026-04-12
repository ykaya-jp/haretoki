import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireProjectMembership(userId: string) {
  const membership = await prisma.projectMember.findFirst({
    where: { userId, acceptedAt: { not: null } },
    select: { projectId: true, role: true },
  });
  if (!membership) redirect("/dashboard");
  return membership;
}

export async function requireOwner(userId: string) {
  const membership = await prisma.projectMember.findFirst({
    where: { userId, role: "owner", acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership) throw new Error("プロジェクトオーナーのみ実行できます");
  return membership;
}
