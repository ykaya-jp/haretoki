import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { isSameOriginRedirectPath } from "@/lib/url-guard";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // SECURITY: `next` is attacker-controllable (OAuth callback URL). Allow only
  // same-origin relative paths; reject protocol-relative ("//evil.com") and
  // userinfo ("@evil.com") tricks that would redirect post-auth to phishing.
  const rawNext = searchParams.get("next");
  const next = rawNext && isSameOriginRedirectPath(rawNext) ? rawNext : "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if the user has a pending partner invitation
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const pendingInvitation = await prisma.projectMember.findFirst({
          where: {
            user: { email: user.email },
            acceptedAt: null,
            role: "partner",
          },
        });

        if (pendingInvitation) {
          return NextResponse.redirect(`${origin}/accept-invite`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
