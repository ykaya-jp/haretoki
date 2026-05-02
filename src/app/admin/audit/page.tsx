import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";

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

  // Distinct action counts (filtered) for the sidebar — gives the
  // operator a quick view of what's been happening.
  const actionCounts = await prisma.auditLog.groupBy({
    by: ["action"],
    where: since ? { createdAt: { gte: since } } : {},
    _count: { action: true },
    orderBy: { _count: { action: "desc" } },
    take: 20,
  });

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
              Action breakdown
            </h2>
            <ul className="space-y-1 text-xs">
              {actionCounts.map((c) => (
                <li
                  key={c.action}
                  className="flex justify-between gap-4 font-mono"
                >
                  <span>{c.action}</span>
                  <span className="text-muted-foreground">
                    {c._count.action}
                  </span>
                </li>
              ))}
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
