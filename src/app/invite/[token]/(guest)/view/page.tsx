import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { prisma } from "@/server/db";
import {
  GUEST_COOKIE_NAME,
  bumpGuestSession,
  guestCookieOptions,
  signGuestSession,
  verifyGuestSession,
} from "@/lib/guest-session";
import { recordGuestInvitationView } from "@/server/actions/invitation-links";
import { GuestUpgradeChip } from "@/components/partner/guest-upgrade-chip";

/**
 * Level 1 Guest landing (`/invite/[token]/view`).
 *
 * Renders a static, read-only snapshot of the project: venue list with
 * names, hero photo, and the inviter's aggregated impression (shown
 * anonymised as「相棒さんの声」). No estimates, no chat, no personal
 * data — §1.6 of the design doc.
 */
export default async function GuestViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  // Pin "now" once per render so the rest of the function is pure
  // w.r.t. the render. connection() already opts us into dynamic
  // rendering so each request is its own "now".
  const now = new Date();

  if (!/^[a-f0-9]{64}$/.test(token)) {
    redirect(`/invite/${token}`);
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const verified = verifyGuestSession(raw);

  // No cookie (or tampered / expired) → send back to the entry screen
  // which can re-issue via /guest-start. Same handling for cookies that
  // point at a different project than the tapped URL.
  if (!verified || verified.payload.token !== token) {
    redirect(`/invite/${token}`);
  }

  const { payload } = verified;

  // Fetch the owner-facing snapshot. Query uses projectId from the cookie
  // (already authenticated via HMAC signature, not Supabase session).
  const invitation = await prisma.projectInvitation.findUnique({
    where: { token: payload.token },
    select: {
      projectId: true,
      consumedAt: true,
      expiresAt: true,
      viewCount: true,
      creator: { select: { name: true, email: true } },
    },
  });

  // Guard: invitation was consumed or expired while the guest cookie was
  // alive. Fall back to the entry screen which shows InvalidCard.
  if (
    !invitation ||
    invitation.consumedAt ||
    invitation.expiresAt.getTime() < now.getTime()
  ) {
    redirect(`/invite/${token}`);
  }

  const [venues, project] = await Promise.all([
    prisma.venue.findMany({
      where: {
        projectId: invitation.projectId,
        status: { not: "rejected" },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        location: true,
        photoUrls: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.project.findUnique({
      where: { id: invitation.projectId },
      select: { name: true },
    }),
  ]);

  const inviterName =
    invitation.creator.name ??
    invitation.creator.email.split("@")[0] ??
    "相棒";

  // --- cookie maintenance: bump screenCount, re-sign (rotation), and
  // record the first view in DB so the owner can see "見てくれました".
  //
  // recordGuestInvitationView is called only on screenCount === 1 so
  // the owner's counter isn't polluted by cheap reload loops within a
  // single guest session. The guest's own counter still bumps every
  // navigation for anti-abuse.
  const wasFirstSeenInThisSession = payload.screenCount <= 1;
  const bumped = bumpGuestSession(payload);
  const reSigned = signGuestSession(bumped);
  cookieStore.set({
    name: GUEST_COOKIE_NAME,
    value: reSigned,
    ...guestCookieOptions(),
  });
  if (wasFirstSeenInThisSession) {
    // Best-effort; never throw.
    await recordGuestInvitationView(token);
  }

  return (
    <div className="space-y-8">
      {/* Editorial hero */}
      <header className="space-y-4 text-center">
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="mx-2 opacity-30">·</span>
          <span>Invitation</span>
        </p>
        <div
          aria-hidden="true"
          className="mx-auto h-px w-20"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 45%, transparent) 50%, transparent 100%)",
          }}
        />
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-light leading-[1.35] tracking-[-0.005em]">
          こんにちは、
          <br />
          <span className="font-normal">{inviterName}さんの相棒さん。</span>
        </h1>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          {inviterName}さんが、
          {project?.name ? `「${project.name}」に` : "ふたりで選ぶ場所に"}
          招いてくれました。
          <br />
          まずは、ちょっと覗いてみてください。
        </p>
        <div className="flex items-center justify-center gap-2">
          <span
            aria-label="読み取り専用モードです"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px]"
            style={{
              background: "color-mix(in oklab, var(--gold-subtle) 60%, transparent)",
              color: "var(--gold-warm)",
            }}
          >
            読み取り専用
          </span>
          <span className="text-[10.5px] text-muted-foreground tabular-nums">
            {venues.length} 件の式場
          </span>
        </div>
      </header>

      {/* Venue list */}
      {venues.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center">
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            {inviterName}さんは、まだ式場を置いていないようです。
            <br />
            また覗きに来てみてください。
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {venues.map((v) => {
            const cover = v.photoUrls?.[0] ?? null;
            return (
              <li key={v.id}>
                <Link
                  href={`/invite/${token}/venues/${v.id}`}
                  prefetch={false}
                  className="group block overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)] transition active:scale-[0.98]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    {cover ? (
                      <Image
                        src={cover}
                        alt=""
                        fill
                        sizes="(max-width: 400px) 100vw, 400px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
                        写真はまだ
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <h3 className="font-[family-name:var(--font-display)] text-[16px] font-light leading-tight">
                      {v.name}
                    </h3>
                    {v.location ? (
                      <p className="text-[12px] text-muted-foreground">
                        {v.location}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer — soft upgrade chip + join CTA */}
      <footer
        className="sticky bottom-0 -mx-6 px-6 pt-4"
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
          background:
            "linear-gradient(to top, var(--background) 65%, transparent)",
        }}
      >
        <GuestUpgradeChip screenCount={payload.screenCount} />
        <Link
          href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition"
        >
          ここから参加する
        </Link>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
          いまは、ちょっと覗くだけでも大丈夫です。
        </p>
      </footer>
    </div>
  );
}
