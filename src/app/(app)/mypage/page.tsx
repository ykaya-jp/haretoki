import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { SettingsForm } from "@/components/settings/settings-form";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { InviteLinkPanel } from "@/components/partner/invite-link-panel";
import { getCurrentInvitationLink } from "@/server/actions/invitation-links";
import { NameEdit } from "@/components/mypage/name-edit";
import { SettingsRow } from "@/components/mypage/settings-row";
import { Settings, Bookmark, Sliders } from "lucide-react";
import { getUnreadCount } from "@/server/actions/notifications";
import { NotificationBadge } from "@/components/layout/notification-badge";

/**
 * Resolve the app's public origin for share URLs.
 * Prefers Vercel-provided headers, falls back to the request's host so
 * preview / local environments generate correct links instead of leaking
 * into production.
 */
async function getAppOrigin(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  // Last-resort fallback (should never hit in practice since Next always
  // provides host on a request).
  return process.env.APP_URL ?? "http://localhost:3000";
}

export const metadata: Metadata = {
  title: "マイページ",
  description: "プロフィールや設定をここから。",
};

export default async function MyPage() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [members, project, appOrigin, invitationLink, unreadCount] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
    getAppOrigin(),
    // E-11: pre-fetch the current live 1-tap invitation link (if any).
    // Catch to avoid crashing mypage when the owner guard fails — invite
    // panel simply falls back to "generate" state.
    getCurrentInvitationLink().catch(() => null),
    // Notification badge count — best-effort, never crash mypage.
    getUnreadCount().catch(() => 0),
  ]);

  const partner = members.find((m) => m.role === "partner");
  const hasPartner = partner?.acceptedAt != null;
  // Distinguish "invited but not yet joined" from "no partner at all" so
  // the mypage panel can show an "招待中…" state rather than re-offering
  // the invite UI to a couple already mid-flow.
  const partnerPending = !!partner && !partner.acceptedAt;

  const conditions = (project?.conditions ?? {}) as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  const ownerName =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  return (
    <div className="space-y-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
            <span aria-hidden="true" className="opacity-30">·</span>
            <span>My</span>
          </p>
          <h1 className="mt-2 text-h1 font-[family-name:var(--font-display)] font-light tracking-[-0.01em]">
            マイページ
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
            プロフィールや設定をここから。
          </p>
        </div>
        <NotificationBadge initialCount={unreadCount} />
      </div>
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-[var(--gold-subtle)]/40 to-transparent"
      />

      {/* Profile */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Profile
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
            プロフィール
          </h3>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">お名前</p>
            <div className="mt-1">
              <NameEdit currentName={ownerName} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">メールアドレス</p>
            <p className="mt-1 font-medium">{user.email}</p>
          </div>
        </div>
      </section>

      {/* Partner */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Partner
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
            パートナー
          </h3>
        </div>
        {hasPartner ? (
          <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs text-muted-foreground">パートナー</p>
            <p className="mt-1 font-medium">
              {partner?.user?.name ?? partner?.user?.email ?? "—"}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--gold-subtle)] px-2.5 py-0.5 text-xs text-[var(--gold-warm)]">
              一緒に参加中
            </span>
          </div>
        ) : partnerPending ? (
          <div className="rounded-2xl border border-[color-mix(in_oklab,var(--gold-warm)_25%,transparent)] bg-card p-5 shadow-[var(--shadow-card)]">
            <p className="text-xs text-muted-foreground">招待中…</p>
            <p className="mt-1 font-medium">
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

            {/* Legacy email-based invite (kept as a fallback option) */}
            <details className="rounded-2xl border border-border/60 bg-card/50">
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

      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-transparent via-[var(--gold-subtle)]/40 to-transparent"
      />

      {/* Conditions */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Preferences
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
            おふたりの希望
          </h3>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
          <SettingsForm initialConditions={conditions} />
        </div>
      </section>

      {/* Link to Settings + Saved Searches */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            More
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
            その他
          </h3>
        </div>
        {/* Notification inbox row removed — hero has a NotificationBadge
            (top-right) that surfaces unread count and links to
            /notifications. The separate list row was duplicating the
            affordance and competing with the frequency setting in /settings
            (the two "通知" items confused users into thinking mypage's "通知"
            was the frequency control). Frequency mode lives only in
            /settings now. */}

        {/* W19-1: previously each link was its own `rounded-2xl bg-card
            p-5 shadow` block, which read as 3 separate cards stacked.
            Audit-sub-A4 P0-1 flagged this as "並べただけ" — replaced with a
            single composed surface (one card, divide-y rows) so the More
            section reads as a settings list, Linear / iOS style. */}
        <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/60">
          <SettingsRow
            href="/mypage/weights"
            icon={Sliders}
            label="次元ごとの重要度"
            meta="料理・費用・雰囲気…どこを重く見る？"
            tone="accent"
          />
          <SettingsRow
            href="/mypage/saved-searches"
            icon={Bookmark}
            label="保存した検索条件"
            meta="新しい式場が出たらお知らせ"
            tone="accent"
          />
          <SettingsRow
            href="/settings"
            icon={Settings}
            label="設定"
            meta="見た目・ログアウト"
          />
        </div>
      </section>
    </div>
  );
}
