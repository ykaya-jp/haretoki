import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users go straight to the app
  if (user) {
    redirect("/home");
  }

  // Unauthenticated users see the landing page
  return <LandingPage />;
}
