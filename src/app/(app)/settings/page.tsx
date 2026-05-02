import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { LogoutButton } from "@/components/settings/logout-button";
import { DataManagement } from "@/components/settings/data-management";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PushPermissionState } from "@/components/notifications/push-permission-state";
import { ReminderTimingSettings } from "@/components/notifications/reminder-timing-settings";
import { PartnerActivitySettings } from "@/components/notifications/partner-activity-settings";
import { getMyNotificationPreference } from "@/server/actions/notification-preferences";
import { ChevronLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "整える",
  description:
    "テーマ、通知の頻度、データの取り扱い、ログアウト。おふたりに合わせて整えられます。",
  // Settings is per-account state — no value to a search crawler and
  // we shouldn't leak the route's existence either.
  robots: { index: false, follow: false },
};

/**
 * D5 audit verdict (designer backlog 🟢 D5, 2026-05-03):
 *
 * Page header is already editorial (gold eyebrow + Shippori h1
 * 「整える」 + Back breadcrumb), and the 3 sub-cards (Theme /
 * Notifications / Data) follow the same eyebrow + serif h3 + bg-card
 * pattern as /mypage and /family-share. No redesign needed.
 *
 * 4 light polishes applied here for v4.2 parity:
 *   1. gradient hairline after the header (matches /journey,
 *      /family-share, /mypage editorial separator)
 *   2. Logout promoted from a bare button into an "Account" card so
 *      the destructive action sits alongside the same eyebrow + h3
 *      vocabulary as the other sections (no longer reads as orphan)
 *   3. Section h3 weight synced to `font-extralight` matching W19-1's
 *      /mypage editorialisation
 *   4. Footer build-version line for Beta operator support — subtle
 *      muted text, no card chrome
 *
 * Out of scope: SettingsForm sits on /mypage (not /settings) and is
 * a different surface; ThemeSwitcher / DataManagement / Notification
 * sub-components stay verbatim.
 */
export default async function SettingsPage() {
  const user = await requireUser();
  const notificationPref = await getMyNotificationPreference();

  return (
    <div className="space-y-10 pb-[env(safe-area-inset-bottom)]">
      {/* Page header — eyebrow + Shippori h1 + back breadcrumb. */}
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <Link
            href="/mypage"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Settings</span>
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-h1 font-light tracking-[-0.01em]">
          整える
        </h1>
      </div>

      {/* Editorial gradient hairline — visual separator between page
          header and the first interactive section. Matches the same
          treatment in /journey + /family-share so the editorial
          rhythm reads as one design language across surfaces. */}
      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 30%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 70%, transparent 100%)",
        }}
      />

      {/* Theme */}
      <section aria-labelledby="settings-theme" className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Theme
          </p>
          <h2
            id="settings-theme"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            見た目
          </h2>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <div>
            <p className="text-sm font-medium">テーマ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              端末に合わせる、またはお好みで
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </section>

      {/* Notifications */}
      <section aria-labelledby="settings-notifications" className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Notifications
          </p>
          <h2
            id="settings-notifications"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            お知らせ
          </h2>
        </div>
        <div className="space-y-5 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <NotificationSettings initialFrequency={notificationPref.frequency} />
          <ReminderTimingSettings
            initialTimings={notificationPref.reminderTimings}
          />
          <PartnerActivitySettings
            initialActivity={notificationPref.partnerActivity}
          />
          <PushPermissionState
            vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
          />
        </div>
      </section>

      {/* Data management (GDPR) */}
      <section aria-labelledby="settings-data" className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Data
          </p>
          <h2
            id="settings-data"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            記録の管理
          </h2>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <DataManagement userEmail={user.email ?? ""} />
        </div>
      </section>

      {/*
        Account — promoted from a bare LogoutButton at the bottom into
        a properly-eyebrowed card so the destructive action sits in the
        same visual rhythm as Theme / Notifications / Data above. The
        button itself stays destructive-tone (red border) — this is
        framing, not de-fanging.
      */}
      <section aria-labelledby="settings-account" className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
            Account
          </p>
          <h2
            id="settings-account"
            className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground"
          >
            アカウント
          </h2>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <LogoutButton />
        </div>
      </section>

      {/*
        Footer build-version line. Subtle muted text only — no card
        chrome — so it reads as ambient operator info, not a settings
        row. Useful during Beta when supports come back with "なんか
        うまくいかない" and the operator wants to know which build the
        user is on. The version string is injected at build time via
        VERCEL_GIT_COMMIT_SHA / NEXT_PUBLIC_APP_VERSION; falls back to
        "dev" so local doesn't render an empty space.
      */}
      <footer
        aria-label="ビルド情報"
        className="mt-2 text-center text-[10.5px] tracking-[0.18em] uppercase text-muted-foreground/60"
      >
        Build · {buildVersionLabel()}
      </footer>
    </div>
  );
}

/**
 * Best-effort version string for the footer. Vercel injects
 * `VERCEL_GIT_COMMIT_SHA` at build time; we display the first 7 chars
 * (matches `git log --oneline`). Local / preview deploys fall back to
 * `NEXT_PUBLIC_APP_VERSION` (developer-set), then to `dev`.
 *
 * No leak: a 7-char SHA isn't sensitive — it's already on the public
 * Vercel deployment URL — and the operator value (knowing which
 * commit a Beta user is on) outweighs the noise.
 */
function buildVersionLabel(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha && sha.length >= 7) return sha.slice(0, 7);
  return process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";
}
