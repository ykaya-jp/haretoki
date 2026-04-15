import { cache, Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { getOrCreateProject } from "@/server/actions/projects";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { BfcacheRefresh } from "@/components/app/bfcache-refresh";
import { prisma } from "@/server/db";

type Project = Awaited<ReturnType<typeof getOrCreateProject>>;

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

// Async Server Component: resolves project + badge counts, then renders
// RealtimeProvider (WebSocket subscription) and nav with badge numbers.
// Placed inside <Suspense> so the main content flushes to the client
// immediately while this DB work is still in flight.
async function NavWithRealtime({
  projectPromise,
}: {
  projectPromise: Promise<Project>;
}) {
  const project = await projectPromise;
  const { favoriteCount, insightCount } = await getBottomNavBadgeCounts(
    project.id,
  );
  return (
    <RealtimeProvider projectId={project.id}>
      <BottomNav badges={{ candidates: favoriteCount, coach: insightCount }} />
    </RealtimeProvider>
  );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Kick the project fetch immediately — do NOT await here so children can
  // start rendering before the DB round-trips complete.
  const projectPromise = getOrCreateProject();

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
      <BfcacheRefresh />
      <main
        id="main-content"
        className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8"
      >
        {children}
      </main>
      <InstallPrompt />
      {/* Stream nav: shell (BottomNav without counts) flushes first while
          getOrCreateProject + badge DB round-trips resolve in the background. */}
      <Suspense fallback={<BottomNav />}>
        <NavWithRealtime projectPromise={projectPromise} />
      </Suspense>
      <Toaster position="bottom-center" />
    </div>
  );
}
