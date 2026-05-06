import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  buildCspHeader,
  buildSupportingSecurityHeaders,
  generateCspNonce,
  isCspDisabled,
  isCspReportOnly,
} from "@/lib/csp";

export async function middleware(request: NextRequest) {
  // Generate the per-request CSP nonce up front. We pass it into
  // downstream Server Components by setting an `x-nonce` request
  // header that `app/layout.tsx` reads via `headers()`. Inline
  // `<script>` tags consume it as the `nonce={...}` attribute so
  // CSP `script-src 'nonce-...'` accepts them.
  const nonce = generateCspNonce();

  // Forward the nonce on the REQUEST headers so RSC can read it.
  // This is the canonical Next.js pattern (see App Router docs:
  // "Adding a Nonce with Middleware").
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Expose pathname so the (app) layout can render the bottom-nav
  // コーチ badge as 0 when the user is already on /coach (avoids the
  // race where layout reads the count concurrently with the page-level
  // markCoachInsightsSeen and shows the stale 6).
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  // Next.js 16 reads the CSP from REQUEST headers and auto-stamps the
  // nonce on framework-generated <script> / <style> tags during SSR.
  // Without this the inline `self.__next_f.push(...)` bundles ship
  // un-nonced and enforce-mode CSP would block React hydration (the
  // 2026-05-03 prod-down). We always emit the request CSP so the
  // framework sees it; the response header is the report-only or
  // enforce variant set in applySecurityHeaders.
  if (!isCspDisabled()) {
    const requestCsp = buildCspHeader({ nonce, reportOnly: false });
    requestHeaders.set("Content-Security-Policy", requestCsp);
  }

  // Run Supabase auth middleware on top of those forwarded headers.
  const response = await updateSession(request, requestHeaders);

  // If auth redirected (to /login), stop here BUT still apply security
  // headers so even the redirect carries CSP / HSTS protection.
  if (response.headers.get("location")) {
    applySecurityHeaders(response, nonce);
    return response;
  }

  const { pathname } = request.nextUrl;

  // Public + excluded paths — skip onboarding check
  const excludedPaths = [
    "/onboarding",
    "/accept-invite",
    "/login",
    "/signup",
    "/callback",
    "/demo",
    "/invite",
    /** Track C-1: family read-only landing — auth-free. */
    "/family",
    "/privacy",
    "/terms",
    /** Password reset — auth-free, supabase recovery session 自前管理 */
    "/forgot-password",
    "/reset-password",
    /**
     * /admin/* も onboarding redirect から除外。requireAdmin が notFound()
     * で 404 を返すため、middleware が先に /onboarding に飛ばすと
     * 「admin URL の存在」が enumeration leak する。supabase/middleware の
     * PUBLIC_PATHS と対称にしておく。
     */
    "/admin",
  ];
  if (pathname === "/" || excludedPaths.some((p) => pathname.startsWith(p))) {
    applySecurityHeaders(response, nonce);
    return response;
  }

  // Onboarding redirect for authenticated users without the cookie
  const onboardingCompleted = request.cookies.get("onboarding_completed")?.value;
  if (!onboardingCompleted) {
    const redirect = NextResponse.redirect(new URL("/onboarding", request.url));
    applySecurityHeaders(redirect, nonce);
    return redirect;
  }

  applySecurityHeaders(response, nonce);
  return response;
}

/**
 * Stamp CSP + supporting security headers on every response. Centralised
 * so the redirect / non-redirect / passthrough branches above stay
 * consistent — a missed branch would mean some pages ship without
 * protection and an auditor would correctly flag it.
 */
function applySecurityHeaders(response: NextResponse, nonce: string): void {
  if (isCspDisabled()) return;

  const reportOnly = isCspReportOnly();
  const csp = buildCspHeader({ nonce, reportOnly });
  const headerName = reportOnly
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";
  response.headers.set(headerName, csp);

  for (const [name, value] of Object.entries(buildSupportingSecurityHeaders())) {
    response.headers.set(name, value);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2|ttf|otf)$).*)",
  ],
};
