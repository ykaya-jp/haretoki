import { cache, Suspense } from "react";
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

// Async Server Component that resolves badge counts and passes them to
// BottomNav. Rendered inside <Suspense> so the nav shell (no badges) flushes
// to the client immediately while this DB round-trip is in flight.
async function NavBadges({ projectId }: { projectId: string }) {
  const { favoriteCount, insightCount } = await getBottomNavBadgeCounts(
    projectId,
  );
  return <BottomNav badges={{ candidates: favoriteCount, coach: insightCount }} />;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

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
      {/* Stream nav badges: shell (BottomNav without counts) flushes first,
          then badge counts arrive via the NavBadges async component. */}
      <Suspense fallback={<BottomNav />}>
        <NavBadges projectId={project.id} />
      </Suspense>
      <Toaster position="bottom-center" />
    </div>
  );
}
