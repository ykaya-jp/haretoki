import { connection } from "next/server";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";
import {
  computeActivityWindows,
  computeAvgVenuesPerProject,
  computeDecisionRate,
  computeFunnel,
  computePartnerAdoptionRate,
} from "@/lib/metrics-aggregations";

/**
 * /admin/metrics — long-term trend dashboard for the operator.
 *
 * Surfaces the metrics we can compute exactly + the metrics we can
 * only proxy. Honest framing in inline copy: each card declares
 * whether it's "exact" or "approx (lower bound)" so the operator
 * doesn't anchor on a number that isn't real.
 *
 * Data sources (no new tables):
 *   - User / Project / ProjectMember / Decision / Venue / Visit
 *     for cohort sizes + funnel + partner adoption
 *   - audit_logs.actorId + notifications.userId for active-user proxy
 *     (DAU/WAU/MAU)
 *   - PushSendLog for push activity rolling counters
 *   - VisitReminderSent for reminder activity rolling counters
 *   - latest AiCostSnapshot for monthly spend reading
 *   - audit_logs where action=user.feedback.submitted for Beta
 *     feedback intake count
 *
 * Auth: requireAdmin() — 404 for non-admins (defence in depth, the
 * page would leak cohort sizes otherwise).
 */

export const metadata = {
  title: "Metrics Dashboard",
  robots: { index: false, follow: false },
};

interface ActivityRow {
  actorId?: string | null;
  userId?: string | null;
}

export default async function AdminMetricsPage() {
  await connection();
  const admin = await requireAdmin();

  await recordAudit({
    action: "admin.metrics.viewed",
    actorId: admin.userId,
    actorRole: "admin",
  });

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalProjects,
    totalDecisions,
    totalVenues,
    membersWithAccept,
    projectsWithVenue,
    projectsWithVisit,
    audit24h,
    audit7d,
    audit30d,
    notif24h,
    notif7d,
    notif30d,
    pushCount7d,
    pushCount30d,
    visitReminders7d,
    feedback7d,
    feedback30d,
    latestCostSnapshot,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.decision.count(),
    prisma.venue.count(),
    // For partner-adoption: count projects that have ≥ 2 acceptedAt
    // members. We can't express that directly in a single Prisma
    // count, so we groupBy projectId + acceptedAt:not null and filter
    // in JS.
    prisma.projectMember.findMany({
      where: { acceptedAt: { not: null } },
      select: { projectId: true },
    }),
    prisma.project.count({ where: { venues: { some: {} } } }),
    prisma.project.count({
      where: { venues: { some: { visits: { some: {} } } } },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since24h } },
      select: { actorId: true },
      take: 5000,
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since7d } },
      select: { actorId: true },
      take: 10000,
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: since30d } },
      select: { actorId: true },
      take: 20000,
    }),
    prisma.notification.findMany({
      where: { createdAt: { gte: since24h } },
      select: { userId: true },
      take: 5000,
    }),
    prisma.notification.findMany({
      where: { createdAt: { gte: since7d } },
      select: { userId: true },
      take: 10000,
    }),
    prisma.notification.findMany({
      where: { createdAt: { gte: since30d } },
      select: { userId: true },
      take: 20000,
    }),
    prisma.pushSendLog.count({ where: { sentAt: { gte: since7d } } }),
    prisma.pushSendLog.count({ where: { sentAt: { gte: since30d } } }),
    prisma.visitReminderSent.count({ where: { sentAt: { gte: since7d } } }),
    prisma.auditLog.count({
      where: {
        action: "user.feedback.submitted",
        createdAt: { gte: since7d },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: "user.feedback.submitted",
        createdAt: { gte: since30d },
      },
    }),
    prisma.aiCostSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { monthlyUsedUsd: true, monthlyBudgetUsd: true, snapshotDate: true },
    }),
  ]);

  // Partner adoption: count distinct projectIds that appear ≥ 2 times
  // in the acceptedAt-only members list.
  const projectMemberCount = new Map<string, number>();
  for (const m of membersWithAccept) {
    projectMemberCount.set(
      m.projectId,
      (projectMemberCount.get(m.projectId) ?? 0) + 1,
    );
  }
  const projectsWithPartner = Array.from(projectMemberCount.values()).filter(
    (n) => n >= 2,
  ).length;

  const partnerAdoption = computePartnerAdoptionRate({
    totalProjects,
    projectsWithPartner,
  });
  const decisionRate = computeDecisionRate({ totalProjects, totalDecisions });
  const venuesAvg = computeAvgVenuesPerProject({ totalProjects, totalVenues });

  // Active-user proxy: union of audit actorId + notification userId
  // within the window. Both sources under-count — many active users
  // never trip an audit row (sensitive ops only) and silent-mode
  // users never get a notification. Reported as "lower bound" in UI.
  const userIdsFrom = (rows: Array<ActivityRow>): string[] =>
    rows
      .map((r) => r.actorId ?? r.userId ?? "")
      .filter((id): id is string => Boolean(id));
  const activity = computeActivityWindows({
    dayUserIds: [...userIdsFrom(audit24h), ...userIdsFrom(notif24h)],
    weekUserIds: [...userIdsFrom(audit7d), ...userIdsFrom(notif7d)],
    monthUserIds: [...userIdsFrom(audit30d), ...userIdsFrom(notif30d)],
  });

  const funnel = computeFunnel({
    totalUsers,
    totalProjects,
    projectsWithVenue,
    projectsWithVisit,
    projectsWithDecision: totalDecisions,
  });

  const monthlyUsed = latestCostSnapshot
    ? Number(latestCostSnapshot.monthlyUsedUsd)
    : 0;
  const monthlyBudget = latestCostSnapshot
    ? Number(latestCostSnapshot.monthlyBudgetUsd)
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Metrics Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Long-term trend view for the operator. Headline cohort sizes
          + funnel are exact (DB count); active-user windows (DAU/WAU/MAU)
          are <strong>lower-bound proxies</strong> from audit_logs +
          notifications and under-count silent-mode users. Phase 5 candidate:
          proper user_activity table or PostHog ingestion. See{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            src/lib/metrics-aggregations.ts
          </code>{" "}
          inline doc for the full contract.
        </p>
      </header>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card label="Total users" value={totalUsers} note="exact" />
        <Card label="Total projects" value={totalProjects} note="exact" />
        <Card label="Total decisions" value={totalDecisions} note="exact" />
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-base font-medium">Activity windows</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Distinct user IDs from audit_logs ∪ notifications in the
          window. Lower bound — silent-mode users + browse-only sessions
          don&rsquo;t leave a row, so real DAU is{" "}
          <strong>at least</strong> the number below.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Stat label="DAU (24h)" value={activity.dau} />
          <Stat label="WAU (7d)" value={activity.wau} />
          <Stat label="MAU (30d)" value={activity.mau} />
          <Stat
            label="stickiness"
            value={`${activity.stickinessPct}%`}
            note="dau / mau"
          />
        </dl>
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-base font-medium">Couple-shape signals</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Stat
            label="partner adoption"
            value={`${partnerAdoption.ratePct}%`}
            note={`${partnerAdoption.projectsWithPartner} / ${partnerAdoption.totalProjects}`}
          />
          <Stat
            label="decision rate"
            value={`${decisionRate.ratePct}%`}
            note={`${decisionRate.totalDecisions} / ${decisionRate.totalProjects}`}
          />
          <Stat
            label="venues / project"
            value={venuesAvg.avgPerProject.toFixed(1)}
            note={`${venuesAvg.totalVenues} venues`}
          />
        </dl>
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-base font-medium">Funnel (% of registered users)</h2>
        <ol className="space-y-2 text-xs">
          {funnel.map((step) => {
            const widthPct = Math.max(2, Math.min(100, step.pctOfUsers));
            return (
              <li key={step.label} className="space-y-1">
                <div className="flex justify-between font-mono">
                  <span>{step.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {step.count} ({step.pctOfUsers.toFixed(1)}%)
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_18%,transparent)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--gold-warm)]"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mb-8 rounded-lg border p-4">
        <h2 className="mb-3 text-base font-medium">Notifications &amp; cost (rolling)</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Stat label="push 7d" value={pushCount7d} />
          <Stat label="push 30d" value={pushCount30d} />
          <Stat label="visit reminders 7d" value={visitReminders7d} />
          <Stat label="Beta feedback 7d" value={feedback7d} />
          <Stat label="Beta feedback 30d" value={feedback30d} />
          <Stat
            label="month-to-date AI cost"
            value={`$${monthlyUsed.toFixed(2)}`}
            note={
              monthlyBudget > 0
                ? `budget $${monthlyBudget.toFixed(0)}`
                : "no snapshot"
            }
          />
        </dl>
      </section>

      <footer className="text-xs text-muted-foreground">
        Helpers:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/lib/metrics-aggregations.ts
        </code>{" "}
        · Audit verb:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          admin.metrics.viewed
        </code>{" "}
        · Phase 5 follow-ups:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          docs/business/churn-prediction-model.md
        </code>
      </footer>
    </main>
  );
}

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl tabular-nums">{value}</p>
      {note ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: number | string;
  note?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-base tabular-nums text-foreground">
        {value}
      </dd>
      {note ? (
        <p className="text-[10.5px] text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}
