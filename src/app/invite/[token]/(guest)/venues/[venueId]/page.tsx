import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { prisma } from "@/server/db";
import {
  GUEST_COOKIE_NAME,
  verifyGuestSession,
} from "@/lib/guest-session";
import { ChevronLeft } from "lucide-react";
import { BumpOnMount } from "@/components/invite/bump-on-mount";

/**
 * Level 1 Guest venue detail (`/invite/[token]/venues/[venueId]`).
 *
 * Read-only. Shows photos, location, access info, and a condensed
 * summary of the owner's impression notes (attributed to「相棒さんの声」
 * — never shows the owner's real name or email).
 */
export default async function GuestVenueDetail({
  params,
}: {
  params: Promise<{ token: string; venueId: string }>;
}) {
  await connection();
  const { token, venueId } = await params;
  // Pin "now" for the render so subsequent comparisons are pure.
  const now = new Date();

  if (!/^[a-f0-9]{64}$/.test(token)) {
    redirect(`/invite/${token}`);
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const verified = verifyGuestSession(raw);
  if (!verified || verified.payload.token !== token) {
    redirect(`/invite/${token}`);
  }
  const { payload } = verified;

  // Must re-check the invitation so consumed / expired states terminate
  // the guest view cleanly.
  const invitation = await prisma.projectInvitation.findUnique({
    where: { token },
    select: { projectId: true, consumedAt: true, expiresAt: true },
  });
  if (
    !invitation ||
    invitation.consumedAt ||
    invitation.expiresAt.getTime() < now.getTime() ||
    invitation.projectId !== payload.projectId
  ) {
    redirect(`/invite/${token}`);
  }

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, projectId: payload.projectId },
    select: {
      id: true,
      name: true,
      location: true,
      accessInfo: true,
      photoUrls: true,
      capacityMin: true,
      capacityMax: true,
      // A single summary snippet — the design calls out "式場名 + 印象メモ"
      // while explicitly hiding estimate line items and chat history.
      visits: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          notes: {
            select: {
              id: true,
              content: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!venue) {
    redirect(`/invite/${token}/view`);
  }

  const firstPhoto = venue.photoUrls?.[0] ?? null;
  const noteSnippets = venue.visits
    .flatMap((v) => v.notes.map((n) => n.content))
    .filter((s): s is string => Boolean(s && s.length > 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Bump guest session cookie via Route Handler (render phase cannot set cookies). */}
      <BumpOnMount token={token} />
      <Link
        href={`/invite/${token}/view`}
        className="inline-flex h-11 items-center gap-1 text-[13px] text-muted-foreground active:scale-[0.98]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.6} />
        一覧にもどる
      </Link>

      {firstPhoto ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted">
          <Image
            src={firstPhoto}
            alt=""
            fill
            sizes="(max-width: 400px) 100vw, 400px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.3]">
          {venue.name}
        </h1>
        {venue.location ? (
          <p className="text-[13px] text-muted-foreground">{venue.location}</p>
        ) : null}
        {venue.accessInfo ? (
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            {venue.accessInfo}
          </p>
        ) : null}
        {venue.capacityMin || venue.capacityMax ? (
          <p className="text-[12px] text-muted-foreground tabular-nums">
            収容人数 {venue.capacityMin ?? "—"}
            〜{venue.capacityMax ?? "—"} 名
          </p>
        ) : null}
      </div>

      {noteSnippets.length > 0 ? (
        <section
          aria-label="相棒さんの声"
          className="space-y-3 rounded-2xl border p-5"
          style={{
            background: "color-mix(in oklab, var(--gold-subtle) 30%, var(--background))",
            borderColor: "color-mix(in oklab, var(--gold-warm) 20%, transparent)",
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold-warm)]">
            相棒さんの声
          </p>
          <ul className="space-y-2">
            {noteSnippets.map((n, i) => (
              <li
                key={i}
                className="font-[family-name:var(--font-display)] text-[14px] font-light leading-relaxed"
              >
                「{n}」
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            参加すると、あなたの印象も並べて残せます。
          </p>
        </section>
      ) : null}

      <div
        className="sticky bottom-0 -mx-6 px-6 pt-4"
        style={{
          paddingBottom:
            "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
          background:
            "linear-gradient(to top, var(--background) 65%, transparent)",
        }}
      >
        <Link
          href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition"
        >
          ここから参加する
        </Link>
      </div>
    </div>
  );
}
