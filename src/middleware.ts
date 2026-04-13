import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // First handle Supabase auth session
  const response = await updateSession(request);

  // If auth redirected (to /login), don't check onboarding
  if (response.headers.get("location")) {
    return response;
  }

  const { pathname } = request.nextUrl;

  // Skip onboarding check for these paths
  const excludedPaths = ["/onboarding", "/accept-invite", "/login", "/signup", "/callback"];
  if (excludedPaths.some((p) => pathname.startsWith(p))) {
    return response;
  }

  // Onboarding redirect: if cookie is not set, redirect to /onboarding
  const onboardingCompleted = request.cookies.get("onboarding_completed")?.value;
  if (!onboardingCompleted) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
