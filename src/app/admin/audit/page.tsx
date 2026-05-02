import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";
import { captureMessage } from "@/lib/sentry";
import {
  aggregateActionCounts,
  aggregateDailyCounts,
  detectSuspiciousAuditPatterns,
  maxCount,
} from "@/lib/audit-aggregations";

/**
 * /admin/audit — AuditLog viewer.
 *
 * Read-only diagnostics surface for the developer / on-call to inspect
 * recent sensitive operations recorded by `recordAudit()` (round 15).
 * Mirrors `/admin/cost` style: minimal HTML + Tailwind utility, no
 * client JS, server-rendered.
 *
 * Filters via search params (URL-driven so the operator can bookmark a
 * specific view):
 *   ?action=user.delete.completed
 *   ?actor=<userId>
 *   ?since=YYYY-MM-DD
 *   ?limit=50    (max 200 — keep DB roundtrip bounded)
 *
 * Auth: `requireAdmin()` (404 for non-admins — see `src/server/admin.ts`).
 */

export const metadata = {
  title: "Audit Viewer",
  robots: { index: false, follow: false },
};

interface SearchParams {
  action?: string;
  actor?: string;
  since?: string;
  limit?: string;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

function parseLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseSince(raw: string | undefined): Date | null {
  if (!raw) return null;
  // Accept YYYY-MM-DD or ISO; treat YYYY-MM-DD as UTC midnight so the
  // bookmark URL works the same regardless of operator timezone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00Z`)
    : new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmtDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;

  // Record the admin view itself (audit-the-auditors). Best-effort.
  await recordAudit({
    action: "admin.audit.viewed",
    actorId: admin.userId,
    actorRole: "admin",
    detail: {
      filters: {
        action: params.action ?? null,
        actor: params.actor ?? null,
        since: params.since ?? null,
      },
    },
  });

  const limit = parseLimit(params.limit);
  const since = parseSince(params.since);
  const where: Record<string, unknown> = {};
  if (params.action) where.action = params.action;
  if (params.actor) where.actorId = params.actor;
  if (since) where.createdAt = { gte: since };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  // Last-30-days projection used by the action-count bar chart, the
  // daily timeline strip, and the suspicious-pattern detector. Pulling
  // this once (and slimming the projection) keeps the page to 3
  // queries total even with the new surfaces. Cap at 5000 rows — past
  // that the operator should narrow with the filter form, and the bar
  // chart renders the top categories anyway.
  const now = new Date();
  const horizonDays = 30;
  const aggHorizon = new Date(now.getTime() - horizonDays * 24 * 60 * 60 * 1000);
  const aggRows = await prisma.auditLog.findMany({
    where: { createdAt: { gte: aggHorizon } },
    select: {
      action: true,
      actorId: true,
      ipAddress: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const actionCounts = aggregateActionCounts(aggRows).slice(0, 20);
  const dailyCounts = aggregateDailyCounts(aggRows, { days: horizonDays, now });
  const dailyMax = maxCount(dailyCounts);
  const actionMax = maxCount(actionCounts);
  const anomalies = detectSuspiciousAuditPatterns(aggRows, now);

  // Surface anomalies to Sentry as a warning so on-call gets notified
  // even if no one happens to be looking at /admin/audit. Best-effort —
  // failure here is silent, the page still renders the banner.
  if (anomalies.length > 0) {
    captureMessage(
      `[admin/audit] ${anomalies.length} suspicious pattern(s) detected`,
      {
        level: "warning",
        component: "auth",
        alertRoute: "p2-email",
        extra: {
          anomalyIds: anomalies.map((a) => a.id),
          maxSeverity: anomalies.some((a) => a.severity === "critical")
            ? "critical"
            : "warning",
        },
      },
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Audit Viewer</h1>
        <p className="mt-1 text-muted-foreground">
          Source:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">audit_logs</code>{" "}
          (populated by{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">recordAudit()</code>{" "}
          in <code>src/server/audit.ts</code>).
        </p>
        <p className="mt-1 text-muted-foreground">
          Showing <strong>{rows.length}</strong> rows
          {Object.keys(where).length > 0 ? " (filtered)" : ""}.
        </p>
      </header>

      {/*
        Suspicious-pattern banner. Threshold rules live in
        `src/lib/audit-aggregations.ts` so they can be unit-tested
        independently. Critical = red border, warning = amber. Empty
        result intentionally renders nothing — no "all clear" copy
        because a green badge invites complacency.
      */}
      {anomalies.length > 0 && (
        <section
          aria-label="Suspicious patterns"
          className="mb-6 space-y-2 rounded-lg border border-rose-300/60 bg-rose-50/50 p-4 text-xs dark:border-rose-900/50 dark:bg-rose-950/20"
        >
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
            Suspicious patterns · last 1h
          </h2>
          <ul className="space-y-1.5">
            {anomalies.map((a) => (
              <li
                key={a.id}
                className={
                  a.severity === "critical"
                    ? "flex items-baseline justify-between gap-3 rounded border-l-2 border-rose-500 bg-rose-100/30 px-2.5 py-1.5 dark:bg-rose-900/20"
                    : "flex items-baseline justify-between gap-3 rounded border-l-2 border-amber-500 bg-amber-100/30 px-2.5 py-1.5 dark:bg-amber-900/20"
                }
              >
                <span className="text-foreground">{a.summary}</span>
                {a.hint ? (
                  <a
                    href={a.hint}
                    className="shrink-0 font-mono text-[10px] text-muted-foreground underline"
                  >
                    drill in
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Daily timeline strip — 30 UTC-day buckets so the operator can
        eyeball spikes without leaving the page. CSS-only bars (no
        client JS) — simplest thing that works on Safari + Chrome
        without a chart library.
      */}
      <section
        aria-label="Daily activity"
        className="mb-6 rounded-lg border p-3"
      >
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Daily activity · {horizonDays}d
          </h2>
          <span className="text-[10px] text-muted-foreground">
            UTC日次バケット · max{" "}
            <span className="tabular-nums">{dailyMax}</span>
          </span>
        </div>
        <ol className="flex h-12 items-end gap-0.5">
          {dailyCounts.map((d) => {
            const heightPct =
              d.count === 0 ? 4 : Math.max(8, Math.round((d.count / dailyMax) * 100));
            return (
              <li
                key={d.date}
                className="flex flex-1 items-end"
                title={`${d.date} · ${d.count}`}
              >
                <div
                  aria-label={`${d.date} ${d.count}件`}
                  className={
                    d.count === 0
                      ? "w-full rounded-sm bg-muted"
                      : "w-full rounded-sm bg-[color-mix(in_oklab,var(--gold-warm)_70%,transparent)]"
                  }
                  style={{ height: `${heightPct}%` }}
                />
              </li>
            );
          })}
        </ol>
        <div className="mt-1 flex justify-between text-[9px] tabular-nums text-muted-foreground">
          <span>{dailyCounts[0]?.date ?? ""}</span>
          <span>{dailyCounts[dailyCounts.length - 1]?.date ?? ""}</span>
        </div>
      </section>

      <section className="mb-6 grid gap-6 sm:grid-cols-[1fr_auto]">
        <form method="get" className="flex flex-wrap gap-3 text-xs">
          <label className="flex flex-col gap-1">
            action
            <input
              type="text"
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="user.delete.completed"
              className="rounded border px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            actor
            <input
              type="text"
              name="actor"
              defaultValue={params.actor ?? ""}
              placeholder="<userId>"
              className="rounded border px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            since
            <input
              type="text"
              name="since"
              defaultValue={params.since ?? ""}
              placeholder="2026-05-01"
              className="rounded border px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            limit
            <input
              type="number"
              name="limit"
              min={1}
              max={MAX_LIMIT}
              defaultValue={String(limit)}
              className="w-20 rounded border px-2 py-1 font-mono"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded bg-primary px-3 py-1 text-primary-foreground"
          >
            Apply
          </button>
        </form>

        {actionCounts.length > 0 && (
          <aside className="rounded-lg border p-3">
            <h2 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              Action breakdown · 30d
            </h2>
            <ul className="space-y-1.5 text-[11px]">
              {actionCounts.map((c) => {
                const widthPct = Math.max(2, Math.round((c.count / actionMax) * 100));
                return (
                  <li key={c.action} className="space-y-0.5">
                    <div className="flex justify-between gap-4 font-mono">
                      <span className="truncate">{c.action}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.count}
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-1 rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_18%,transparent)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--gold-warm)]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </section>

      <section>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Time (UTC)</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    No audit rows match the current filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono">{r.action}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className="block max-w-[12ch] truncate" title={r.actorId}>
                        {r.actorId}
                      </span>
                      {r.actorRole && (
                        <span className="block text-[10px] text-muted-foreground">
                          {r.actorRole}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {r.targetType ? (
                        <>
                          {r.targetType}
                          {r.targetId ? (
                            <span
                              className="block max-w-[12ch] truncate text-[10px] text-muted-foreground"
                              title={r.targetId}
                            >
                              {r.targetId}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px]">
                      {r.ipAddress ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.detail ? (
                        <details>
                          <summary className="cursor-pointer text-[10px] text-muted-foreground">
                            view
                          </summary>
                          <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap text-[10px]">
                            {JSON.stringify(r.detail, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-8 text-xs text-muted-foreground">
        Helper:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/server/audit.ts
        </code>{" "}
        · Schema: AuditLog · Doc:{" "}
        <a
          className="underline"
          href="https://github.com/ykaya-jp/haretoki/blob/main/docs/harness/sentry-alerts.md"
        >
          sentry-alerts.md
        </a>
      </footer>
    </main>
  );
}
