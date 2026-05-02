import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ChevronLeft, UserCheck } from "lucide-react";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { InviteLinkPanel } from "@/components/partner/invite-link-panel";
import { getCurrentInvitationLink } from "@/server/actions/invitation-links";

/**
 * /mypage/partner-invite — dedicated full-page partner invite surface.
 *
 * Round 21: A-5 introduced an onboarding-completion hint that linked to
 * `/mypage#partner-invite` because no dedicated route existed yet — the
 * partner invite UI lived inline inside the mypage Partner section.
 * This page promotes the same UI to a first-class destination so:
 *
 *   - The onboarding hint (and any future deep-link from email,
 *     notifications, share sheets) lands on a focused screen instead
 *     of scrolling past unrelated mypage sections
 *   - The flow gets its own `<title>` + meta for browser history /
 *     share previews
 *   - Future copy / partner-specific analytics can attach here without
 *     bloating mypage further
 *
 * The mypage Partner section is intentionally PRESERVED (not collapsed
 * into a summary tile) — existing users who navigate via mypage shouldn't
 * see a behaviour change. Both surfaces render the same components from
 * src/components/partner/, so a copy / treatment edit propagates to both
 * via the leaf components, not via this page.
 *
 * Three states from the data flow:
 *   - `hasPartner`     — partner accepted; show "一緒に参加中" badge
 *   - `partnerPending` — invited but not yet joined; show 1-tap link
 *                        + "招待中…" copy
 *   - default          — no invitation yet; show 1-tap link + email
 *                        fallback in a <details>
 */

export const metadata: Metadata = {
  title: "パートナーを招く",
  description:
    "おふたりで式場さがしをするための招待リンクを発行・管理できます。",
};

async function getAppOrigin(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return process.env.APP_URL ?? "http://localhost:3000";
}

export default async function PartnerInvitePage() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [members, appOrigin, invitationLink] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
    }),
    getAppOrigin(),
    // Same `.catch(() => null)` posture as mypage/page.tsx — a server
    // failure on the side fetch shouldn't take the whole page down;
    // the InviteLinkPanel can render its "generate" state from null.
    getCurrentInvitationLink().catch(() => null),
  ]);

  const partner = members.find((m) => m.role === "partner");
  const hasPartner = partner?.acceptedAt != null;
  const partnerPending = !!partner && !partner.acceptedAt;

  return (
    <div className="space-y-8 pb-8">
      {/* Breadcrumb back to mypage. Plain text-style link (not a button)
          so it reads as navigation rather than an action — same pattern
          as the other mypage sub-routes (saved-searches, weights). */}
      <Link
        href="/mypage"
        prefetch={true}
        className="inline-flex min-h-11 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={1.6} aria-hidden />
        マイページに戻る
      </Link>

      {/* Page header — eyebrow + serif h1 + framing subtitle. The eyebrow
          mirrors the onboarding hint copy ("おふたりで使うともっと楽しい")
          on purpose so a user arriving via that hint feels the
          continuity. */}
      <header className="space-y-2">
        <p className="text-[11.5px] tracking-[0.2em] uppercase text-[var(--gold-warm)]">
          おふたりで使うともっと楽しい
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[24px] font-light leading-snug tracking-[-0.005em] text-foreground sm:text-[26px]">
          パートナーを招く
        </h1>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          招待リンクをお相手に送ると、ふたりで同じ式場さがしを進められます。
          見学の感想や見積もりを並べて、ゆっくり選べます。
        </p>
      </header>

      {/* State-driven panel — identical three-branch logic to the mypage
          Partner section, lifted verbatim so the visual treatment stays
          synchronised across the two entry points until / unless we
          consciously diverge them. */}
      <section aria-label="パートナーの招待状況" className="space-y-5">
        {hasPartner ? (
          <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/50">
            <div className="grid min-h-11 grid-cols-[96px_1fr] items-center gap-4 px-5 py-3.5">
              <span className="text-[12px] text-muted-foreground">名前</span>
              <span className="truncate text-[14px] font-medium">
                {partner?.user?.name ?? partner?.user?.email ?? "—"}
              </span>
            </div>
            <div className="px-5 py-3.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-subtle)] px-2.5 py-1 text-[12px] text-[var(--gold-warm)]">
                <UserCheck className="h-4 w-4" strokeWidth={1.6} />
                一緒に参加中
              </span>
            </div>
          </div>
        ) : partnerPending ? (
          <div className="rounded-2xl border border-[color-mix(in_oklab,var(--gold-warm)_25%,transparent)] bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-[12px] text-muted-foreground">招待中…</p>
            <p className="mt-1 text-[14px] font-medium">
              {partner?.user?.email ?? "—"}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              招待リンクを送りました。受け取った方が「合流する」を押すと、
              ふたりの式場さがしが始まります。
            </p>
            <div className="mt-4 border-t border-border pt-4">
              <InviteLinkPanel initialLink={invitationLink} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* E-11: 1-tap invite (preferred) */}
            <InviteLinkPanel initialLink={invitationLink} />

            {/* Legacy email-based invite (kept as fallback) */}
            <details className="rounded-2xl border border-border/60 bg-surface-raised">
              <summary className="cursor-pointer list-none p-4 text-[12.5px] text-muted-foreground hover:text-foreground">
                メールアドレスで招く（従来の方法）
              </summary>
              <div className="p-4 pt-0">
                <PartnerInvite
                  inviteLink={`${appOrigin}/accept-invite`}
                  partnerStatus={partner ? "invited" : "not_invited"}
                />
              </div>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
