import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";

/**
 * /admin/visit-reminders — visit-reminder cron observability.
 *
 * Joins three tables to give the operator a single screen for
 * "are we sending the reminders we promised, and are couples letting
 * us send them?":
 *
 *   1. VisitReminderSent — every successful send the cron has booked,
 *      grouped per phase. Top of page = phase × last-7-day fan-out so
 *      a stuck cron is visible at a glance.
 *   2. NotificationPreference — per-phase opt-out toggles
 *      (`reminders_day_before` / `_morning_of` / `_way_home`) plus the
 *      Resend suppression metadata that B-2 / round 18 set up. Splits
 *      the user base into "we can reach them" vs "they opted out" vs
 *      "they were auto-suppressed (hard bounce / complaint / soft)".
 *   3. Recent send history — last 50 send rows so the operator can
 *      eyeball "did the most recent run go through?" without psql.
 *
 * Intentionally read-only: re-running the cron, force-resetting a
 * suppression, or unsubscribing on a user's behalf all live in their
 * own surfaces (cron has /api/cron/visit-reminder, suppression has
 * /api/cron/email-suppression-retry, and the user owns their own
 * settings on /settings). This page just answers "what is the state?".
 */

export const metadata = {
  title: "Visit reminders",
  robots: { index: false, follow: false },
};

const PHASES = ["day_before", "morning_of", "way_home"] as const;
type Phase = (typeof PHASES)[number];

const PHASE_LABEL: Record<Phase, string> = {
  day_before: "前日 (19 JST)",
  morning_of: "当日朝 (8 JST)",
  way_home: "帰り道",
};

function fmtJst(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function AdminVisitRemindersPage() {
  const admin = await requireAdmin();

  await recordAudit({
    action: "admin.visit_reminders.viewed",
    actorId: admin.userId,
    actorRole: "admin",
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Phase × last-7-day send fanout. Two queries (totals + 7d) so
  //    the table can show both columns; group-by lets us avoid a
  //    full table scan.
  const [phaseTotalsRaw, phaseRecentRaw, totalUsers, prefAggregates] =
    await Promise.all([
      prisma.visitReminderSent.groupBy({
        by: ["phase"],
        _count: { _all: true },
      }),
      prisma.visitReminderSent.groupBy({
        by: ["phase"],
        where: { sentAt: { gt: weekAgo } },
        _count: { _all: true },
      }),
      prisma.user.count(),
      prisma.notificationPreference.aggregate({
        _count: {
          _all: true,
          remindersDayBefore: true,
          remindersMorningOf: true,
          remindersWayHome: true,
        },
      }),
    ]);

  const phaseTotal: Record<string, number> = {};
  for (const r of phaseTotalsRaw) phaseTotal[r.phase] = r._count._all;
  const phaseRecent: Record<string, number> = {};
  for (const r of phaseRecentRaw) phaseRecent[r.phase] = r._count._all;

  // 2. Per-phase opt-in counts. The default for each `reminders*` flag
  //    is `true` so a user with NO NotificationPreference row at all
  //    (the row is created lazily) still counts as opted-in. We therefore
  //    compute opt-IN as "users with no row" + "users whose row has the
  //    flag true".
  const [optedInDayBefore, optedInMorningOf, optedInWayHome] =
    await Promise.all([
      prisma.notificationPreference.count({
        where: { remindersDayBefore: true },
      }),
      prisma.notificationPreference.count({
        where: { remindersMorningOf: true },
      }),
      prisma.notificationPreference.count({
        where: { remindersWayHome: true },
      }),
    ]);

  const usersWithPref = prefAggregates._count._all ?? 0;
  const usersWithoutPref = Math.max(0, totalUsers - usersWithPref);
  const optInTotals = {
    day_before: optedInDayBefore + usersWithoutPref,
    morning_of: optedInMorningOf + usersWithoutPref,
    way_home: optedInWayHome + usersWithoutPref,
  };

  // 3. Suppression breakdown. Each reason is a hard category in B-2
  //    (`hard_bounce` / `complained` / `soft_bounce` / `manual`).
  const suppressionRaw = await prisma.notificationPreference.groupBy({
    by: ["emailSuppressedReason"],
    _count: { _all: true },
    where: { emailSuppressedReason: { not: null } },
  });
  const suppression: Record<string, number> = {};
  for (const r of suppressionRaw) {
    if (r.emailSuppressedReason) {
      suppression[r.emailSuppressedReason] = r._count._all;
    }
  }

  // 4. Most recent 50 sends — operator's "did the run go?" check.
  const recentSends = await prisma.visitReminderSent.findMany({
    orderBy: { sentAt: "desc" },
    take: 50,
    include: {
      user: { select: { email: true } },
      visit: {
        select: { id: true, venue: { select: { name: true } } },
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Visit reminders</h1>
        <p className="mt-1 text-muted-foreground">
          Cron observability for{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            visit_reminder_sent
          </code>{" "}
          + per-phase opt-in coverage from{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            notification_preferences
          </code>
          . Read-only — re-runs and resets live in their own routes.
        </p>
      </header>

      {/* Phase × send-volume table */}
      <section className="mb-8 rounded-lg border">
        <h2 className="border-b bg-muted/40 px-3 py-2 text-[13px] font-medium">
          Phase fan-out
        </h2>
        <table className="w-full text-[12.5px]">
          <thead className="border-b bg-muted/30 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Phase</th>
              <th className="px-3 py-2 font-medium tabular-nums">
                Last 7 days
              </th>
              <th className="px-3 py-2 font-medium tabular-nums">All-time</th>
              <th className="px-3 py-2 font-medium tabular-nums">
                Opt-in coverage
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {PHASES.map((phase) => {
              const optIn = optInTotals[phase];
              const pct = totalUsers > 0
                ? Math.round((optIn / totalUsers) * 100)
                : 0;
              return (
                <tr key={phase}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{PHASE_LABEL[phase]}</p>
                    <p className="font-mono text-[10.5px] text-muted-foreground">
                      {phase}
                    </p>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {(phaseRecent[phase] ?? 0).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {(phaseTotal[phase] ?? 0).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {optIn.toLocaleString("ja-JP")} / {totalUsers}
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      ({pct}%)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t bg-muted/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          Coverage counts users without a NotificationPreference row as
          opted-in (the row is created lazily and the field defaults to
          true). Total users: {totalUsers.toLocaleString("ja-JP")}.
        </p>
      </section>

      {/* Suppression breakdown */}
      <section className="mb-8 rounded-lg border">
        <h2 className="border-b bg-muted/40 px-3 py-2 text-[13px] font-medium">
          Email suppression breakdown
        </h2>
        {Object.keys(suppression).length === 0 ? (
          <p className="px-3 py-4 text-muted-foreground">
            No active email suppressions.
          </p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="border-b bg-muted/30 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium tabular-nums">Users</th>
                <th className="px-3 py-2 font-medium">Retry policy</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(
                ["hard_bounce", "complained", "soft_bounce", "manual"] as const
              ).map((reason) => {
                const count = suppression[reason] ?? 0;
                if (count === 0) return null;
                return (
                  <tr key={reason}>
                    <td className="px-3 py-2 font-mono">{reason}</td>
                    <td className="px-3 py-2 tabular-nums">{count}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {reason === "soft_bounce"
                        ? "Auto-retry after 7 days"
                        : reason === "manual"
                          ? "User opt-out — never auto-retry"
                          : "Permanent — never auto-retry"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Recent sends */}
      <section className="rounded-lg border">
        <h2 className="border-b bg-muted/40 px-3 py-2 text-[13px] font-medium">
          Recent sends (50)
        </h2>
        {recentSends.length === 0 ? (
          <p className="px-3 py-4 text-muted-foreground">
            No sends yet — the cron either has not fired or has not had
            any visits in scope.
          </p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="border-b bg-muted/30 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Sent at (JST)</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Phase</th>
                <th className="px-3 py-2 font-medium">Visit</th>
                <th className="px-3 py-2 font-medium">Date key</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentSends.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 tabular-nums">
                    {fmtJst(row.sentAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {row.user?.email ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {row.phase}
                  </td>
                  <td className="px-3 py-2">
                    <p className="truncate">
                      {row.visit?.venue?.name ?? "(deleted venue)"}
                    </p>
                    <p className="font-mono text-[10.5px] text-muted-foreground">
                      {row.visit?.id.slice(0, 8)}…
                    </p>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums">
                    {row.scheduledDateKey}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
