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
  const excludedPaths = ["/onboarding", "/accept-invite", "/login", "/signup", "/callback", "/settings", "/mypage", "/demo"];
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
