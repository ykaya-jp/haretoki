import { AppNav } from "@/components/layout/app-nav";
import { ProgressBar } from "@/components/layout/progress-bar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { getOrCreateProject } from "@/server/actions/projects";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  return (
    <div className="min-h-dvh bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <AppNav />
      <ProgressBar currentStep={project.currentStep} />
      <RealtimeProvider projectId={project.id}>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </RealtimeProvider>
      <MobileBottomNav />
      <Toaster position="bottom-center" />
    </div>
  );
}
