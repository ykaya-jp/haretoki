import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { DuelClient } from "@/components/candidates/duel-client";

export const metadata: Metadata = {
  title: "情景で決める",
  description: "2つの式場を情景ベースの問いで比べ、ふたりの気持ちを確かめます。",
};

interface DuelPageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function DuelPage({ searchParams }: DuelPageProps) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const { a: venueAId, b: venueBId } = await searchParams;

  if (!venueAId || !venueBId || venueAId === venueBId) {
    notFound();
  }

  // 両式場がこのプロジェクトに属することを確認
  const venues = await prisma.venue.findMany({
    where: {
      id: { in: [venueAId, venueBId] },
      projectId,
    },
    select: {
      id: true,
      name: true,
      photoUrls: true,
    },
  });

  if (venues.length !== 2) {
    notFound();
  }

  const raw = (id: string) => venues.find((v) => v.id === id)!;
  const toVenue = (v: { id: string; name: string; photoUrls: string[] }) => ({
    id: v.id,
    name: v.name,
    photoUrl: v.photoUrls[0] ?? null,
  });

  return (
    <div className="px-0">
      <DuelClient venueA={toVenue(raw(venueAId))} venueB={toVenue(raw(venueBId))} />
    </div>
  );
}
