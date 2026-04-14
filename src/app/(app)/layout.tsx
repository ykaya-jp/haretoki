import { cache } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { getOrCreateProject } from "@/server/actions/projects";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { prisma } from "@/server/db";

// Wrap the bottom-nav badge counts in React.cache so adjacent renders within
// the same request (e.g. streaming boundaries) share a single DB round-trip.
// Same pattern as getAIInsights in src/server/actions/insights.ts.
const getBottomNavBadgeCounts = cache(async (projectId: string) => {
  const [favoriteCount, insightCount] = await Promise.all([
    prisma.venueFavorite.count({ where: { venue: { projectId } } }),
    prisma.aiAnalysis.count({
      where: {
        projectId,
        type: { in: ["comparison", "review_summary", "visit_prep"] },
      },
    }),
  ]);
  return { favoriteCount, insightCount };
});

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();
  const { favoriteCount, insightCount } = await getBottomNavBadgeCounts(
    project.id,
  );

  return (
    <div className="min-h-dvh bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      {/* Skip link — WCAG 2.4.1 bypass-blocks. Keyboard users land on this
          first and can jump over the persistent bottom nav / header chrome. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        メインコンテンツへスキップ
      </a>
      <OfflineBanner />
      <RealtimeProvider projectId={project.id}>
        <main
          id="main-content"
          className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8"
        >
          {children}
        </main>
      </RealtimeProvider>
      <InstallPrompt />
      <BottomNav badges={{ candidates: favoriteCount, coach: insightCount }} />
      <Toaster position="bottom-center" />
    </div>
  );
}
