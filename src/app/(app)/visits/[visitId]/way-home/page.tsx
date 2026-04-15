import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { WayHomeFlow } from "@/components/visits/way-home-flow";

export const metadata = {
  title: "帰り道モード",
  description: "見学直後の印象を、親指 1 本で 3 分で残します。",
};

interface PageProps {
  params: Promise<{ visitId: string }>;
}

export default async function WayHomePage({ params }: PageProps) {
  const { visitId } = await params;

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const visit = await prisma.visit.findFirst({
    where: { id: visitId, venue: { projectId } },
    include: { venue: { select: { name: true } } },
  });
  if (!visit) notFound();

  return <WayHomeFlow visitId={visit.id} venueName={visit.venue.name} />;
}
