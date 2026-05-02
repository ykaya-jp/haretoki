import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public paths that don't require authentication. Kept at module scope so
// the allocation cost is paid once per process instead of per request.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/callback",
  "/accept-invite",
  "/demo",
  "/invite",
  /** Track C-1: family read-only invitation landing — no auth required. */
  "/family",
  "/privacy",
  "/terms",
] as const;

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  for (const p of PUBLIC_PATHS) {
    if (pathname.startsWith(p)) return true;
  }
  return false;
}

export async function updateSession(
  request: NextRequest,
  /**
   * Optional forwarded request headers (e.g. CSP nonce stamped by the
   * outer middleware). Passing them here lets `NextResponse.next()`
   * pipe the headers into the request the downstream Server Component
   * sees via `headers()` — which is how `app/layout.tsx` reads
   * `x-nonce` for inline-script gating.
   */
  forwardedHeaders?: Headers,
) {
  const nextOptions = forwardedHeaders
    ? { request: { headers: forwardedHeaders } }
    : { request };
  const supabaseResponse = NextResponse.next(nextOptions);

  // Fast path: public routes don't need to know who the user is. The
  // previous implementation called supabase.auth.getUser() on every
  // request — that's a network roundtrip to Supabase *before* we even
  // checked whether the route was public, adding ~40-120ms of server
  // latency to landing / login / demo pages. Skipping the getUser()
  // call here keeps those routes fully cold-serverless-friendly and
  // still relies on the non-middleware server auth guards for any
  // protected action they perform.
  if (isPublicPath(request.nextUrl.pathname)) {
    return supabaseResponse;
  }

  // Protected path: verify the cookie with Supabase. createServerClient
  // only gets instantiated here so we don't allocate it on public
  // routes either.
  let mutableResponse = supabaseResponse;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          mutableResponse = NextResponse.next(nextOptions);
          cookiesToSet.forEach(({ name, value, options }) =>
            mutableResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return mutableResponse;
}
