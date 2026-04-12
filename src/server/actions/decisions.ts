"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const decisionSchema = z.object({
  selectedVenueId: z.string().uuid("式場を選択してください"),
  rationale: z.string().optional(),
});

export async function makeDecision(input: z.input<typeof decisionSchema>) {
  const validation = decisionSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, role: "owner", acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership)
    return { error: { _form: ["プロジェクトオーナーのみ決定できます"] } };

  await prisma.venue.update({
    where: { id: validation.data.selectedVenueId },
    data: { status: "selected" },
  });

  const decision = await prisma.decision.upsert({
    where: { projectId: membership.projectId },
    update: {
      selectedVenueId: validation.data.selectedVenueId,
      rationale: validation.data.rationale ?? null,
    },
    create: {
      projectId: membership.projectId,
      selectedVenueId: validation.data.selectedVenueId,
      rationale: validation.data.rationale ?? null,
    },
  });

  revalidatePath("/decision");
  revalidatePath("/dashboard");
  revalidatePath("/venues");
  return { decision };
}

export async function getDecision() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership) return null;

  return prisma.decision.findUnique({
    where: { projectId: membership.projectId },
    include: { venue: true },
  });
}
