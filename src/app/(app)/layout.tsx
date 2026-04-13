import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { getOrCreateProject } from "@/server/actions/projects";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { prisma } from "@/server/db";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  // Badge counts for BottomNav
  const [favoriteCount, insightCount] = await Promise.all([
    prisma.venueFavorite.count({ where: { venue: { projectId: project.id } } }),
    prisma.aiAnalysis.count({
      where: { projectId: project.id, type: { in: ["comparison", "review_summary", "visit_prep"] } },
    }),
  ]);

  return (
    <div className="min-h-dvh bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      <OfflineBanner />
      <RealtimeProvider projectId={project.id}>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </RealtimeProvider>
      <InstallPrompt />
      <BottomNav badges={{ candidates: favoriteCount, coach: insightCount }} />
      <Toaster position="bottom-center" />
    </div>
  );
}
