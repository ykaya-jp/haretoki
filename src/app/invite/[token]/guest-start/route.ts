/**
 * POST /invite/[token]/guest-start
 *
 * Called from the welcome card's「ここだけ見る」form. Validates the token,
 * sets the signed guest cookie, and redirects the partner to the Level 1
 * landing at /invite/[token]/view. Never consumes `ProjectInvitation`.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import {
  GUEST_COOKIE_NAME,
  buildGuestSession,
  guestCookieOptions,
  signGuestSession,
  verifyGuestSession,
} from "@/lib/guest-session";

type Params = { token: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  const { token } = await params;
  const origin = new URL(req.url).origin;

  // Status 303 forces the redirected request method to GET so that a POST
  // from the welcome card's <form> lands on the GET-only Server Component
  // pages (`/invite/[token]` and `/invite/[token]/view`). The Next.js
  // default of 307 preserves the POST method and would 405 / error-boundary
  // out of the destination.
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(new URL(`/invite/${token}`, origin), 303);
  }

  const invitation = await prisma.projectInvitation.findUnique({
    where: { token },
    select: {
      projectId: true,
      consumedAt: true,
      expiresAt: true,
    },
  });

  // Any invalid / consumed / expired state → bounce back to the landing
  // which will render the appropriate InvalidCard (enumeration-resistant).
  if (
    !invitation ||
    invitation.consumedAt ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    return NextResponse.redirect(new URL(`/invite/${token}`, origin), 303);
  }

  const cookieStore = await cookies();

  // Cross-project switch confirm: if the partner already has a guest
  // cookie pointing at a *different* projectId, preserve that cookie and
  // surface a confirm screen. The confirm endpoint re-POSTs here with
  // a `?confirm=1` search param to force the overwrite.
  const existing = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const verified = existing ? verifyGuestSession(existing) : null;
  const url = new URL(req.url);
  const forcedConfirm = url.searchParams.get("confirm") === "1";
  if (
    verified &&
    verified.payload.projectId !== invitation.projectId &&
    !forcedConfirm
  ) {
    return NextResponse.redirect(
      new URL(`/invite/${token}?switch=1`, origin),
      303,
    );
  }

  const payload = buildGuestSession({
    token,
    projectId: invitation.projectId,
  });
  const signed = signGuestSession(payload);

  const res = NextResponse.redirect(
    new URL(`/invite/${token}/view`, origin),
    303,
  );
  res.cookies.set({
    name: GUEST_COOKIE_NAME,
    value: signed,
    ...guestCookieOptions(),
  });
  return res;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  // GET is for "continue as guest" links shared from email; same semantics.
  return POST(req, { params });
}
