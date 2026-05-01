import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { activeBackendName } from "@/lib/rate-limit";

/**
 * /admin/cost — Anthropic spend dashboard skeleton.
 *
 * Reads the last 30 daily snapshots persisted by the
 * `/api/cron/ai-cost-summary` cron and renders a compact table the
 * developer can scan during a coffee break to confirm "we're nowhere
 * near the budget" or to triage a Sentry alert.
 *
 * Auth: `requireAdmin()` (404 for non-admins — see `src/server/admin.ts`).
 *
 * Style: deliberately not the marketing palette. The Editorial
 * brand surfaces are for couples, not the operator's internal tooling.
 * Plain HTML + Tailwind utility classes that read fine in dark / light
 * without theming customisation. Server-rendered, no client JS — this
 * is a read-only diagnostics view, not an interactive surface.
 */

export const metadata = {
  title: "Cost Dashboard",
  // Block crawlers from indexing the admin surface even if Vercel
  // accidentally exposes it. The notFound() guard in requireAdmin
  // handles unauthenticated access; this is defence in depth.
  robots: { index: false, follow: false },
};

interface SnapshotRow {
  snapshotDate: Date;
  dailyUsedUsd: number;
  dailyBudgetUsd: number;
  monthlyUsedUsd: number;
  monthlyBudgetUsd: number;
  shouldAlert: boolean;
  dailyByBucket: Record<string, { calls: number; estCostUsd: number }> | null;
}

function pct(used: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.round((used / budget) * 100);
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function fmtJstDate(d: Date): string {
  // Snapshot date is stored as Postgres DATE — Prisma returns it as a
  // Date with time set to 00:00 UTC. We display the YYYY-MM-DD portion
  // directly without further timezone math (the cron writes JST date,
  // see `jstDateOnly` in the cron route).
  return d.toISOString().slice(0, 10);
}

export default async function AdminCostPage() {
  await requireAdmin();

  const rows = await prisma.aiCostSnapshot.findMany({
    orderBy: { snapshotDate: "desc" },
    take: 30,
  });

  const snapshots: SnapshotRow[] = rows.map((r) => ({
    snapshotDate: r.snapshotDate,
    dailyUsedUsd: Number(r.dailyUsedUsd),
    dailyBudgetUsd: Number(r.dailyBudgetUsd),
    monthlyUsedUsd: Number(r.monthlyUsedUsd),
    monthlyBudgetUsd: Number(r.monthlyBudgetUsd),
    shouldAlert: r.shouldAlert,
    dailyByBucket:
      (r.dailyByBucket as Record<
        string,
        { calls: number; estCostUsd: number }
      > | null) ?? null,
  }));

  const latest = snapshots[0];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Cost Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Anthropic API daily spend snapshots. Source:
          <code className="mx-1 rounded bg-muted px-1.5 py-0.5">
            ai_cost_snapshots
          </code>
          (populated by{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            /api/cron/ai-cost-summary
          </code>
          ).
        </p>
        <p className="mt-1 text-muted-foreground">
          Rate-limit backend:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            {activeBackendName()}
          </code>
        </p>
      </header>

      {latest ? (
        <section className="mb-8 rounded-lg border p-4">
          <h2 className="mb-3 text-base font-medium">Latest snapshot</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Date</dt>
              <dd className="font-mono">{fmtJstDate(latest.snapshotDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Daily</dt>
              <dd className="font-mono">
                {fmtUsd(latest.dailyUsedUsd)} /{" "}
                {fmtUsd(latest.dailyBudgetUsd)}{" "}
                <span className="text-muted-foreground">
                  ({pct(latest.dailyUsedUsd, latest.dailyBudgetUsd)}%)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Monthly</dt>
              <dd className="font-mono">
                {fmtUsd(latest.monthlyUsedUsd)} /{" "}
                {fmtUsd(latest.monthlyBudgetUsd)}{" "}
                <span className="text-muted-foreground">
                  ({pct(latest.monthlyUsedUsd, latest.monthlyBudgetUsd)}%)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Alert</dt>
              <dd className="font-mono">
                {latest.shouldAlert ? (
                  <span className="text-red-600">tripped</span>
                ) : (
                  <span className="text-green-600">ok</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <p className="rounded border border-dashed p-4 text-muted-foreground">
          No snapshots yet — run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            curl -X POST -H &quot;authorization: Bearer $CRON_SECRET&quot;
            https://&lt;host&gt;/api/cron/ai-cost-summary
          </code>{" "}
          to backfill the first row.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-base font-medium">Last 30 snapshots</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Daily $</th>
                <th className="px-3 py-2 font-medium">Daily %</th>
                <th className="px-3 py-2 font-medium">Monthly $</th>
                <th className="px-3 py-2 font-medium">Monthly %</th>
                <th className="px-3 py-2 font-medium">Alert</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr
                  key={s.snapshotDate.toISOString()}
                  className={s.shouldAlert ? "bg-red-50 dark:bg-red-950/30" : ""}
                >
                  <td className="px-3 py-2 font-mono">
                    {fmtJstDate(s.snapshotDate)}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {fmtUsd(s.dailyUsedUsd)}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {pct(s.dailyUsedUsd, s.dailyBudgetUsd)}%
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {fmtUsd(s.monthlyUsedUsd)}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {pct(s.monthlyUsedUsd, s.monthlyBudgetUsd)}%
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {s.shouldAlert ? "⚠" : "·"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {latest?.dailyByBucket && (
          <details className="mt-4 rounded border p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Latest dailyByBucket detail (JSON)
            </summary>
            <pre className="mt-2 overflow-x-auto text-xs">
              {JSON.stringify(latest.dailyByBucket, null, 2)}
            </pre>
          </details>
        )}
      </section>

      <footer className="mt-8 text-xs text-muted-foreground">
        運用 doc:{" "}
        <a className="underline" href="https://github.com/ykaya-jp/haretoki/blob/main/docs/ai/cost-baseline.md">
          docs/ai/cost-baseline.md
        </a>{" "}
        — Sentry alert routing:{" "}
        <a className="underline" href="https://github.com/ykaya-jp/haretoki/blob/main/docs/harness/sentry-alerts.md">
          docs/harness/sentry-alerts.md
        </a>
      </footer>
    </main>
  );
}
