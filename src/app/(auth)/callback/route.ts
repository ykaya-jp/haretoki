import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

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
