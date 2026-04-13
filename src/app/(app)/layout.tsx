import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { getOrCreateProject } from "@/server/actions/projects";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  return (
    <div className="min-h-dvh bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      <OfflineBanner />
      <RealtimeProvider projectId={project.id}>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </RealtimeProvider>
      <InstallPrompt />
      <BottomNav />
      <Toaster position="bottom-center" />
    </div>
  );
}
