import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LandingPage,
  type LandingVariant,
} from "@/components/landing/landing-page";
import { MotionProvider } from "@/components/providers/motion-provider";

interface RootPageProps {
  /** Next.js 15+ passes searchParams as a Promise. We only read `?v=`
   *  but the param is awaited so the route stays compatible with the
   *  cacheComponents flag enabled in next.config.ts. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Phase 2 prep — landing copy A/B variant resolution. The actual A/B
 * framework lands in Phase 3; this commit makes both variants buildable
 * so the future framework can swap them via cookie / experiment SDK
 * without re-deploying.
 *
 * Resolution order (first match wins):
 *   1. `?v=warm` query string — dogfood a single session without
 *      a rebuild.
 *   2. `NEXT_PUBLIC_LANDING_VARIANT` env at build time — ship the warm
 *      copy across a whole preview deployment without flipping a flag.
 *   3. "control" — production default (the copy currently in prod).
 *
 * Unknown / typo'd values fall through to "control" — never throw.
 */
function resolveVariant(
  qs: Record<string, string | string[] | undefined> | undefined,
): LandingVariant {
  const raw = qs?.v;
  const fromQuery = Array.isArray(raw) ? raw[0] : raw;
  const fromEnv = process.env.NEXT_PUBLIC_LANDING_VARIANT;
  const candidate = (fromQuery ?? fromEnv ?? "").toLowerCase();
  if (candidate === "warm") return "warm";
  return "control";
}

export default async function RootPage({ searchParams }: RootPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users go straight to the app
  if (user) {
    redirect("/home");
  }

  const qs = await searchParams;
  const variant = resolveVariant(qs);

  // Unauthenticated users see the landing page.
  // W16-6: MotionProvider scoped here (instead of root layout) so /login,
  // /signup, /accept-invite and /invite/[token] don't pay the LazyMotion
  // features eager load on FCP.
  return (
    <MotionProvider>
      <LandingPage variant={variant} />
    </MotionProvider>
  );
}
