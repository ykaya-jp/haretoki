"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import type { AgreementStatus } from "@/generated/prisma/client";

const agreementStatusSchema = z.enum(["discussing", "decided", "revisit"]);

const createAgreementSchema = z.object({
  text: z
    .string()
    .min(1, "内容を入力してください")
    .max(200, "200文字以内で入力してください"),
  status: agreementStatusSchema.default("discussing"),
});

export async function getAgreements() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.coupleAgreement.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createAgreement(
  text: string,
  status: AgreementStatus = "discussing",
) {
  const parsed = createAgreementSchema.safeParse({ text, status });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const agreement = await prisma.coupleAgreement.create({
    data: {
      projectId,
      text: parsed.data.text,
      status: parsed.data.status,
      createdBy: user.id,
    },
  });

  revalidatePath("/coach");
  revalidateTag(`project:${projectId}`, { expire: 0 });

  return { agreement };
}

export async function updateAgreementStatus(
  id: string,
  status: AgreementStatus,
) {
  const statusParsed = agreementStatusSchema.safeParse(status);
  if (!statusParsed.success) {
    return { error: "無効なステータスです" };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.coupleAgreement.findFirst({
    where: { id, projectId },
  });
  if (!existing) {
    return { error: "合意事項が見つかりません" };
  }

  const agreement = await prisma.coupleAgreement.update({
    where: { id },
    data: { status: statusParsed.data },
  });

  revalidatePath("/coach");
  revalidateTag(`project:${projectId}`, { expire: 0 });

  return { agreement };
}

export async function deleteAgreement(id: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.coupleAgreement.findFirst({
    where: { id, projectId },
  });
  if (!existing) {
    return { error: "合意事項が見つかりません" };
  }

  await prisma.coupleAgreement.delete({ where: { id } });

  revalidatePath("/coach");
  revalidateTag(`project:${projectId}`, { expire: 0 });

  return { success: true };
}
