import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // If auth redirected (to /login), stop here
  if (response.headers.get("location")) {
    return response;
  }

  const { pathname } = request.nextUrl;

  // Public + excluded paths — skip onboarding check
  const excludedPaths = ["/onboarding", "/accept-invite", "/login", "/signup", "/callback", "/demo", "/invite", "/privacy", "/terms"];
  if (pathname === "/" || excludedPaths.some((p) => pathname.startsWith(p))) {
    return response;
  }

  // Onboarding redirect for authenticated users without the cookie
  const onboardingCompleted = request.cookies.get("onboarding_completed")?.value;
  if (!onboardingCompleted) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const runtime = "edge";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
