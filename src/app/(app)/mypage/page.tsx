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
import {
  Settings,
  Bookmark,
  Sliders,
  UserCheck,
} from "lucide-react";
import { getUnreadCount } from "@/server/actions/notifications";
import { NotificationBadge } from "@/components/layout/notification-badge";

/**
 * Resolve the app's public origin for share URLs.
 */
async function getAppOrigin(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return process.env.APP_URL ?? "http://localhost:3000";
}

export const metadata: Metadata = {
  title: "マイページ",
  description: "プロフィールや設定をここから。",
};

export default async function MyPage() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [members, project, appOrigin, invitationLink, unreadCount] =
    await Promise.all([
      prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { conditions: true },
      }),
      getAppOrigin(),
      getCurrentInvitationLink().catch(() => null),
      getUnreadCount().catch(() => 0),
    ]);

  const partner = members.find((m) => m.role === "partner");
  const hasPartner = partner?.acceptedAt != null;
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
    <div className="space-y-12 pb-8">
      {/* Page header */}
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

      {/* Gold hairline separator */}
      <div
        aria-hidden="true"
        className="h-px"
        style={{ background: "var(--hairline-gold)" }}
      />

      {/* Account — Profile (name + email as unified list) */}
      <section aria-labelledby="section-account" className="space-y-5">
        <div className="flex items-baseline gap-2 px-1">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Account
          </p>
          <h2
            id="section-account"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            わたしのこと
          </h2>
        </div>
        <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/50">
          {/* Name row */}
          <div className="grid min-h-11 grid-cols-[96px_1fr] items-center gap-4 px-5 py-3.5">
            <span className="text-[12px] text-muted-foreground">お名前</span>
            <NameEdit currentName={ownerName} />
          </div>
          {/* Email row */}
          <div className="grid min-h-11 grid-cols-[96px_1fr] items-center gap-4 px-5 py-3.5">
            <span className="text-[12px] text-muted-foreground">メール</span>
            <span className="truncate text-[14px] font-medium">
              {user.email}
            </span>
          </div>
        </div>
      </section>

      {/* Partner */}
      <section aria-labelledby="section-partner" className="space-y-5">
        <div className="flex items-baseline gap-2 px-1">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Partner
          </p>
          <h2
            id="section-partner"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            パートナー
          </h2>
        </div>

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

      {/* Gold hairline separator */}
      <div
        aria-hidden="true"
        className="h-px"
        style={{ background: "var(--hairline-gold)" }}
      />

      {/* Preferences */}
      <section aria-labelledby="section-preferences" className="space-y-5">
        <div className="flex items-baseline gap-2 px-1">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Preferences
          </p>
          <h2
            id="section-preferences"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            おふたりの希望
          </h2>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
          <SettingsForm initialConditions={conditions} />
        </div>
      </section>

      {/* More — unified SettingsRow list */}
      <section aria-labelledby="section-more" className="space-y-5">
        <div className="flex items-baseline gap-2 px-1">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            More
          </p>
          <h2
            id="section-more"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            その他
          </h2>
        </div>

        {/* All navigation rows share the same SettingsRow structure */}
        <div className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] divide-y divide-border/50">
          <SettingsRow
            icon={Sliders}
            tone="accent"
            label="次元ごとの重要度"
            meta="料理・費用・雰囲気…どこを重く見る？"
            href="/mypage/weights"
          />
          <SettingsRow
            icon={Bookmark}
            tone="accent"
            label="保存した検索条件"
            meta="新しい式場が出たらお知らせ"
            href="/mypage/saved-searches"
          />
          <SettingsRow
            icon={Settings}
            tone="default"
            label="設定"
            meta="見た目・ログアウト"
            href="/settings"
          />
        </div>
      </section>
    </div>
  );
}
