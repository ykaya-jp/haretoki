/**
 * POST /invite/[token]/bump
 *
 * Route Handler for bumping a guest session cookie (screenCount++ / lastSeenAt).
 * Runs in the 'action' phase so cookies().set() is permitted.
 *
 * Called from BumpOnMount (client component) via useEffect on mount.
 * Server Components must NOT call cookies().set() directly — doing so throws
 * ReadonlyRequestCookiesError in Next.js 16's render phase.
 *
 * Additionally records the first guest view against the invitation DB row so
 * the owner's progression dot shows "そっと見てくれました".
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import {
  GUEST_COOKIE_NAME,
  bumpGuestSession,
  guestCookieOptions,
  signGuestSession,
  verifyGuestSession,
} from "@/lib/guest-session";
import { recordGuestInvitationView } from "@/server/actions/invitation-links";

type Params = { token: string };

export async function POST(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const { token } = await params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ ok: false, reason: "invalid_token" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const verified = verifyGuestSession(raw);

  if (!verified || verified.payload.token !== token) {
    return NextResponse.json({ ok: false, reason: "invalid_cookie" }, { status: 401 });
  }

  const { payload } = verified;

  // Validate the invitation is still live before bumping.
  const invitation = await prisma.projectInvitation.findUnique({
    where: { token },
    select: { consumedAt: true, expiresAt: true },
  });
  if (
    !invitation ||
    invitation.consumedAt ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json({ ok: false, reason: "invitation_inactive" }, { status: 410 });
  }

  // Record first view in DB (idempotency: only when screenCount is still at
  // the initial value set by guest-start, i.e. 1).
  if (payload.screenCount <= 1) {
    await recordGuestInvitationView(token);
  }

  // Bump screenCount + lastSeenAt, re-sign, write back.
  const bumped = bumpGuestSession(payload);
  const reSigned = signGuestSession(bumped);

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: GUEST_COOKIE_NAME,
    value: reSigned,
    ...guestCookieOptions(),
  });
  return res;
}
