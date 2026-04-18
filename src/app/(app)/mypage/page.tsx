import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { SettingsForm } from "@/components/settings/settings-form";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { InviteLinkPanel } from "@/components/partner/invite-link-panel";
import { getCurrentInvitationLink } from "@/server/actions/invitation-links";
import { NameEdit } from "@/components/mypage/name-edit";
import { Settings, ChevronRight, Bookmark, Bell } from "lucide-react";
import Link from "next/link";
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

  const hasPartner = members.some((m) => m.role === "partner" && m.acceptedAt);
  const partner = members.find((m) => m.role === "partner");

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
    <div className="space-y-8">
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
            <p className="mt-1 font-medium">{partner?.user?.name ?? partner?.user?.email ?? "—"}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--gold-subtle)] px-2.5 py-0.5 text-xs text-[var(--gold-warm)]">
              一緒に参加中
            </span>
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
        <div className="space-y-3">
          {/* Notification inbox */}
          <Link
            href="/notifications"
            prefetch
            className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-[var(--gold-warm)]" />
              <div>
                <p className="font-medium">通知</p>
                <p className="text-xs text-muted-foreground">新着のお知らせ</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--destructive)] px-1 text-[11px] font-medium text-primary-foreground tabular-nums">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>

          {/* E-10: Saved search conditions */}
          <Link
            href="/mypage/saved-searches"
            prefetch
            className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <Bookmark className="h-5 w-5 text-[var(--gold-warm)]" />
              <div>
                <p className="font-medium">保存した検索条件</p>
                <p className="text-xs text-muted-foreground">新しい式場が出たらお知らせ</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            href="/settings"
            prefetch
            className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">設定</p>
                <p className="text-xs text-muted-foreground">見た目・ログアウト</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </section>
    </div>
  );
}
