import { BottomNav } from "@/components/layout/bottom-nav";
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
    <div className="min-h-dvh bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      <RealtimeProvider projectId={project.id}>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </RealtimeProvider>
      <BottomNav />
      <Toaster position="bottom-center" />
    </div>
  );
}
