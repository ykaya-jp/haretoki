import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";
import { cache } from "react";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

export const requireProjectMembership = cache(async (userId: string) => {
  const membership = await prisma.projectMember.findFirst({
    where: { userId, acceptedAt: { not: null } },
    select: { projectId: true, role: true },
  });
  // No project yet — send them through onboarding instead of looping back
  // to /home (which would re-enter this function and infinite-redirect).
  if (!membership) redirect("/onboarding");
  return membership;
});

export async function requireOwner(userId: string) {
  const membership = await prisma.projectMember.findFirst({
    where: { userId, role: "owner", acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership) throw new Error("プロジェクトオーナーのみ実行できます");
  return membership;
}

export async function requireVenueAccess(userId: string, venueId: string) {
  const { projectId } = await requireProjectMembership(userId);
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
  });
  if (!venue || venue.projectId !== projectId) {
    throw new Error("式場が見つからないか、アクセス権がありません");
  }
  return { projectId, venue };
}

export async function requireVisitAccess(userId: string, visitId: string) {
  const { projectId } = await requireProjectMembership(userId);
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { venue: { select: { projectId: true, id: true } } },
  });
  if (!visit || visit.venue.projectId !== projectId) {
    throw new Error("見学記録が見つからないか、アクセス権がありません");
  }
  return { projectId, visit };
}
