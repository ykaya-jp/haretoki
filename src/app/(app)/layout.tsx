import { cache, Suspense } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { getOrCreateProject } from "@/server/actions/projects";
import { requireUser } from "@/server/auth";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegistry } from "@/components/pwa/service-worker-registry";
import { BfcacheRefresh } from "@/components/app/bfcache-refresh";
import { prisma } from "@/server/db";

type Project = Awaited<ReturnType<typeof getOrCreateProject>>;

// Wrap the bottom-nav badge counts in React.cache so adjacent renders within
// the same request (e.g. streaming boundaries) share a single DB round-trip.
// Same pattern as getAIInsights in src/server/actions/insights.ts.
//
// Per-user scoping: favorites are a personal affordance (each partner's
// own "候補"), so the badge must reflect only the signed-in user's
// VenueFavorite rows — not the project-wide total. Without this scoping
// a partner who hasn't favorited anything still saw the owner's "3"
// badge, which looked wrong on first sign-in. insightCount stays
// project-wide because AI analyses are shared artefacts (both members
// review the same comparison / review summary output).
const getBottomNavBadgeCounts = cache(
  async (projectId: string, userId: string) => {
    const [favoriteCount, insightCount] = await Promise.all([
      prisma.venueFavorite.count({
        where: { userId, venue: { projectId } },
      }),
      prisma.aiAnalysis.count({
        where: {
          projectId,
          type: { in: ["comparison", "review_summary", "visit_prep"] },
        },
      }),
    ]);
    return { favoriteCount, insightCount };
  },
);

// Async Server Component: resolves project + badge counts, then renders
// RealtimeProvider (WebSocket subscription) and nav with badge numbers.
// Placed inside <Suspense> so the main content flushes to the client
// immediately while this DB work is still in flight.
async function NavWithRealtime({
  projectPromise,
  userId,
}: {
  projectPromise: Promise<Project>;
  userId: string;
}) {
  const project = await projectPromise;
  const { favoriteCount, insightCount } = await getBottomNavBadgeCounts(
    project.id,
    userId,
  );
  return (
    <RealtimeProvider projectId={project.id}>
      <BottomNav badges={{ candidates: favoriteCount, coach: insightCount }} />
    </RealtimeProvider>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth fetch must finish before streaming so BottomNav sees the real
  // userId. requireUser hits Supabase which is ~30ms; well worth it for
  // correctly-scoped per-user badge counts. Kept project fetch as a
  // non-awaited promise so children can stream before it resolves.
  const user = await requireUser();
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
      <ServiceWorkerRegistry />
      {/* Stream nav: shell (BottomNav without counts) flushes first while
          getOrCreateProject + badge DB round-trips resolve in the background. */}
      <Suspense fallback={<BottomNav />}>
        <NavWithRealtime projectPromise={projectPromise} userId={user.id} />
      </Suspense>
      <Toaster position="bottom-center" />
    </div>
  );
}
