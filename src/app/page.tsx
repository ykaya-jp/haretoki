import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";
import { MotionProvider } from "@/components/providers/motion-provider";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users go straight to the app
  if (user) {
    redirect("/home");
  }

  // Unauthenticated users see the landing page.
  // W16-6: MotionProvider scoped here (instead of root layout) so /login,
  // /signup, /accept-invite and /invite/[token] don't pay the LazyMotion
  // features eager load on FCP.
  return (
    <MotionProvider>
      <LandingPage />
    </MotionProvider>
  );
}
