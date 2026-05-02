import { connection } from "next/server";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import {
  buildSupabaseHealthUrl,
  classifyLatency,
  HEALTH_OK_THRESHOLD_MS,
  HEALTH_DEGRADED_THRESHOLD_MS,
  HEALTH_PROBE_TIMEOUT_MS,
  probeAnthropicEnv,
  probeResendEnv,
  probeSupabaseEnv,
  probeVercelEnv,
  type EnvProbeResult,
  type HealthStatus,
} from "@/lib/health-check";
import { CRON_NAMES, type CronName } from "@/lib/cron-audit";
import { getSentryIncidents } from "@/lib/sentry-incidents";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import {
  buildStorageListUrl,
  classifyStorageUsage,
  DEFAULT_STORAGE_LIMIT_BYTES,
  formatBytes,
  KNOWN_BUCKETS,
  parseStorageListResponse,
  STORAGE_CRITICAL_THRESHOLD_PCT,
  STORAGE_WARN_THRESHOLD_PCT,
  type KnownBucket,
  type StorageStatus,
} from "@/lib/storage-monitor";

/**
 * /admin/health — multi-service health view.
 *
 * Born from the 2026-05-03 incident — Supabase free-tier auto-paused,
 * the operator (= author) didn't notice until prod was already
 * blank for ~3 minutes. This page is a "single pane of glass" for
 * eyeballing all 4 upstream dependencies before triage.
 *
 * Two probe modes (deliberate split):
 *   - **live probe** for Supabase: a real fetch at request time so
 *     the operator sees a dead project the moment they open this
 *     page. Wraps the same helper the daily cron uses, so what
 *     /admin/health says here is what /api/cron/supabase-health
 *     would say overnight.
 *   - **env probe** for Anthropic / Resend / Vercel: just check the
 *     env vars are wired. We don't ping Anthropic per page load
 *     (per-call cost is non-trivial, the daily AI-cost cron already
 *     covers spend health). Resend health is observable via the
 *     webhook-ops.md SQL queries.
 *
 * Auth: `requireAdmin()` (404 for non-admins — see `src/server/admin.ts`).
 */

export const metadata = {
  title: "Health Dashboard",
  robots: { index: false, follow: false },
};

interface SupabaseLiveProbe {
  status: HealthStatus;
  latencyMs: number | null;
  statusCode: number | null;
  error: string | null;
}

async function liveProbeSupabase(): Promise<SupabaseLiveProbe | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const probeUrl = buildSupabaseHealthUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    HEALTH_PROBE_TIMEOUT_MS,
  );
  const start = Date.now();
  try {
    const response = await fetch(probeUrl, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - start;
    return {
      status: classifyLatency(latencyMs),
      latencyMs,
      statusCode: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      status: "failed",
      latencyMs:
        err instanceof Error && err.name === "AbortError" ? null : latencyMs,
      statusCode: null,
      error:
        err instanceof Error && err.name === "AbortError"
          ? `timeout after ${HEALTH_PROBE_TIMEOUT_MS}ms`
          : err instanceof Error
            ? err.message
            : "unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

interface BucketProbe {
  bucket: KnownBucket;
  totalBytes: number | null;
  fileCount: number | null;
  /** True when the page returned 1000 objects (= probe is a lower bound). */
  paginated: boolean;
  status: StorageStatus;
  pct: number;
  error: string | null;
}

/**
 * Live probe a single bucket via Supabase Storage REST list endpoint.
 * Reads the first page (≤ 1000 objects) and sums object metadata.size.
 * Honest about the approximation — for 1000+ object buckets the
 * `paginated` flag is true and the dashboard surfaces "lower bound".
 *
 * 5s AbortController timeout per bucket so a slow Storage doesn't
 * stall the whole /admin/health page.
 */
async function liveProbeBucket(
  supabaseUrl: string,
  serviceRoleKey: string,
  bucket: KnownBucket,
  limitBytes: number,
): Promise<BucketProbe> {
  const STORAGE_PAGE_SIZE = 1000;
  const url = buildStorageListUrl(supabaseUrl, bucket);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: STORAGE_PAGE_SIZE,
        offset: 0,
        prefix: "",
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      const { status } = classifyStorageUsage(0, limitBytes);
      return {
        bucket,
        totalBytes: null,
        fileCount: null,
        paginated: false,
        status,
        pct: 0,
        error: `HTTP ${response.status}`,
      };
    }
    const rows = (await response.json()) as ReadonlyArray<{
      name: string;
      metadata?: { size?: number | null } | null;
    }>;
    const { totalBytes, fileCount } = parseStorageListResponse(rows);
    const cls = classifyStorageUsage(totalBytes, limitBytes);
    return {
      bucket,
      totalBytes,
      fileCount,
      paginated: rows.length >= STORAGE_PAGE_SIZE,
      status: cls.status,
      pct: cls.pct,
      error: null,
    };
  } catch (err) {
    return {
      bucket,
      totalBytes: null,
      fileCount: null,
      paginated: false,
      status: "ok",
      pct: 0,
      error:
        err instanceof Error && err.name === "AbortError"
          ? "timeout after 5000ms"
          : err instanceof Error
            ? err.message
            : "unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function AdminHealthPage() {
  // Opt out of static prerender — the live Supabase probe must run
  // per-request. `connection()` is the Cache Components-compatible
  // way; `export const dynamic = "force-dynamic"` is rejected when
  // cacheComponents is enabled.
  await connection();
  const admin = await requireAdmin();

  // Audit the view (audit-the-auditors). Best-effort.
  await recordAudit({
    action: "admin.health.viewed",
    actorId: admin.userId,
    actorRole: "admin",
  });

  // Run the live probe + env probes + cron run history + Sentry
  // incidents in parallel — env probes are synchronous so the wait
  // is dominated by the network calls (Supabase + Sentry REST).
  // React Compiler flags Date.now() as impure-during-render. For a
  // server-component dashboard we want "now at request time" exactly
  // — the per-request rebuild is the correct semantic, not a regression.
  // (Same disable as src/app/admin/cost/page.tsx:99.)
  // eslint-disable-next-line react-hooks/purity
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Storage probe needs the service-role key to bypass RLS on
  // storage.objects. Service-role is server-only and never reaches
  // the client. When unset (= local dev w/o full env), the probe
  // silently no-ops and the dashboard renders "env unset" cards.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storageLimitBytes = (() => {
    const raw = process.env.SUPABASE_STORAGE_LIMIT_BYTES;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_STORAGE_LIMIT_BYTES;
  })();

  const bucketProbesPromise: Promise<BucketProbe[] | null> =
    supabaseUrl && serviceRoleKey
      ? Promise.all(
          KNOWN_BUCKETS.map((bucket) =>
            liveProbeBucket(supabaseUrl, serviceRoleKey, bucket, storageLimitBytes),
          ),
        )
      : Promise.resolve(null);

  const [
    liveSupabase,
    envSupabase,
    envVercel,
    envAnthropic,
    envResend,
    cronRunRows,
    sentryIncidents,
    bucketProbes,
  ] = await Promise.all([
    liveProbeSupabase(),
    Promise.resolve(probeSupabaseEnv()),
    Promise.resolve(probeVercelEnv()),
    Promise.resolve(probeAnthropicEnv()),
    Promise.resolve(probeResendEnv()),
    // Phase 4: pull all cron.run audit rows from the past 24h. The
    // (action, createdAt) index makes this cheap; we group + reduce
    // in JS for cleanest "latest per cron" semantics.
    prisma.auditLog
      .findMany({
        where: { action: "cron.run", createdAt: { gte: since24h } },
        select: { detail: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
      .catch(() => [] as Array<{ detail: unknown; createdAt: Date }>),
    getSentryIncidents(),
    bucketProbesPromise,
  ]);

  // Group cron rows by detail.cron and keep the latest run per cron.
  // Crons that haven't run in the last 24h appear with `latest: null`
  // so the table makes silence visible (= alert signal).
  type CronRunSummary = {
    cron: string;
    latestAt: Date | null;
    ok: boolean | null;
    durationMs: number | null;
    error: string | null;
  };
  const latestByCron = new Map<string, CronRunSummary>();
  for (const row of cronRunRows) {
    const detail = row.detail as
      | { cron?: string; ok?: boolean; durationMs?: number; error?: string }
      | null;
    const cron = detail?.cron;
    if (!cron) continue;
    if (latestByCron.has(cron)) continue; // findMany is desc, first hit wins
    latestByCron.set(cron, {
      cron,
      latestAt: row.createdAt,
      ok: typeof detail?.ok === "boolean" ? detail.ok : null,
      durationMs:
        typeof detail?.durationMs === "number" ? detail.durationMs : null,
      error: typeof detail?.error === "string" ? detail.error : null,
    });
  }
  const cronSummaries: CronRunSummary[] = (CRON_NAMES as readonly CronName[]).map(
    (name) =>
      latestByCron.get(name) ?? {
        cron: name,
        latestAt: null,
        ok: null,
        durationMs: null,
        error: null,
      },
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <header className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-medium">Health Dashboard</h1>
          {/* Phase 4: 5-minute auto-refresh so the operator can leave
              this open on a wall display. Toggle on the right of the
              title row mirrors how Datadog / Grafana surface the same
              control. */}
          <AutoRefresh />
        </div>
        <p className="mt-2 text-muted-foreground">
          Live probe of upstream services. Source: per-request fetch
          for Supabase, env presence for the others. The daily{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            /api/cron/supabase-health
          </code>{" "}
          cron uses the same Supabase probe helper to keep the project
          warm and to alert when latency degrades. Runbook:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            docs/harness/supabase-auto-pause-prevention.md
          </code>
          .
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Thresholds:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            ≤ {HEALTH_OK_THRESHOLD_MS}ms
          </code>{" "}
          ok ·{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            ≤ {HEALTH_DEGRADED_THRESHOLD_MS}ms
          </code>{" "}
          degraded · slower / failed responses → alert
        </p>
      </header>

      <section className="space-y-4">
        {/* Supabase — live probe */}
        <article className="rounded-lg border p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-medium">Supabase</h2>
            <StatusBadge
              status={liveSupabase?.status ?? "failed"}
              note={liveSupabase ? null : "env unset"}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">latency</dt>
              <dd className="font-mono tabular-nums">
                {liveSupabase?.latencyMs !== null &&
                liveSupabase?.latencyMs !== undefined
                  ? `${liveSupabase.latencyMs} ms`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">HTTP status</dt>
              <dd className="font-mono tabular-nums">
                {liveSupabase?.statusCode ?? "—"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">env</dt>
              <dd className="text-foreground/80">
                {envSupabase.present ? "configured" : envSupabase.missingHint}
              </dd>
            </div>
          </dl>
          {liveSupabase?.error ? (
            <p className="mt-3 rounded border-l-2 border-rose-400 bg-rose-50/40 px-3 py-1.5 font-mono text-[11px] text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
              {liveSupabase.error}
            </p>
          ) : null}
        </article>

        {/* Vercel — env probe (always present in deployed env) */}
        <article className="rounded-lg border p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-medium">Vercel runtime</h2>
            <StatusBadge status="ok" note="this page rendered" />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">commit</dt>
              <dd className="font-mono tabular-nums">
                {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">region</dt>
              <dd className="font-mono">
                {process.env.VERCEL_REGION ?? "local"}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">env</dt>
              <dd className="text-foreground/80">
                {envVercel.missingHint ?? "configured"}
              </dd>
            </div>
          </dl>
        </article>

        <EnvProbeCard
          name="Anthropic"
          probe={envAnthropic}
          note="env-only probe (per-call ping is non-trivial cost; spend health is in /admin/cost)."
        />

        <EnvProbeCard
          name="Resend"
          probe={envResend}
          note="env-only probe; delivery health is in docs/harness/webhook-ops.md SQL queries."
        />
      </section>

      {/*
        Phase 4 storage usage. Per-bucket live probe via Supabase
        Storage REST `/object/list` (≤ 1000 objects per page). Rows
        with `paginated: true` declare "lower bound" honestly because
        we don't paginate further — the list endpoint costs a row scan
        and the operator just needs an order-of-magnitude signal.
        For exact numbers + projection, the operator opens the
        Supabase dashboard via the link below.
      */}
      <section className="mt-8 rounded-lg border p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-medium">Storage usage</h2>
          <span className="text-[11px] text-muted-foreground">
            limit{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              {formatBytes(storageLimitBytes)}
            </code>{" "}
            · warn ≥ {STORAGE_WARN_THRESHOLD_PCT}% · critical ≥{" "}
            {STORAGE_CRITICAL_THRESHOLD_PCT}%
          </span>
        </div>
        {bucketProbes === null ? (
          <p className="text-xs text-muted-foreground">
            env unset — set{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            +{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            to enable per-bucket size probe.
          </p>
        ) : (
          <ul className="space-y-2">
            {bucketProbes.map((p) => {
              const widthPct = Math.max(2, Math.min(100, p.pct));
              const barColour =
                p.status === "critical"
                  ? "bg-rose-500"
                  : p.status === "warn"
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <li key={p.bucket} className="space-y-1.5 text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono">{p.bucket}</span>
                    <StatusBadge
                      status={mapStorageToHealth(p.status)}
                      note={`${p.pct.toFixed(1)}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[10.5px] text-muted-foreground">
                    <span className="font-mono tabular-nums">
                      {p.totalBytes !== null
                        ? `${formatBytes(p.totalBytes)} · ${p.fileCount ?? 0} files`
                        : "—"}
                    </span>
                    {p.paginated ? (
                      <span title="probe paged at first 1000 objects — actual total is HIGHER">
                        lower bound
                      </span>
                    ) : null}
                    {p.error ? (
                      <span className="text-rose-700 dark:text-rose-300">
                        {p.error}
                      </span>
                    ) : null}
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-1 rounded-full bg-muted"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${barColour}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Probe reads the first 1000 objects per bucket; for buckets
          with more files the displayed total is a <em>lower bound</em>.
          For exact numbers, open the Supabase dashboard → Storage tab.
          Threshold: {STORAGE_WARN_THRESHOLD_PCT}% / {STORAGE_CRITICAL_THRESHOLD_PCT}%
          of {formatBytes(storageLimitBytes)} (override via{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            SUPABASE_STORAGE_LIMIT_BYTES
          </code>{" "}
          on Pro tier).
        </p>
      </section>

      {/* Phase 4: Sentry incidents (last 24h). Server-side fetch via
          REST API; falls back to a dashboard link when SENTRY_AUTH_TOKEN
          is unset (dev / preview). Counts are intentionally summarised
          (errors + warnings) rather than per-issue — the dashboard link
          is the right surface for triage. */}
      <section className="mt-8 rounded-lg border p-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-medium">Sentry incidents (24h)</h2>
          {sentryIncidents.dashboardUrl ? (
            <a
              href={sentryIncidents.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
            >
              dashboard ↗
            </a>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">errors</dt>
            <dd className="font-mono tabular-nums">
              {sentryIncidents.errorCount ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">warnings</dt>
            <dd className="font-mono tabular-nums">
              {sentryIncidents.warningCount ?? "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">configured</dt>
            <dd className="text-foreground/80">
              {sentryIncidents.configured
                ? "REST probe live"
                : sentryIncidents.error ?? "env unset"}
            </dd>
          </div>
        </dl>
        {sentryIncidents.error && sentryIncidents.configured ? (
          <p className="mt-3 rounded border-l-2 border-amber-400 bg-amber-50/40 px-3 py-1.5 font-mono text-[11px] text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            {sentryIncidents.error}
          </p>
        ) : null}
      </section>

      {/* Phase 4: Cron health monitor.
          Source: AuditLog rows with action = "cron.run", written by
          src/lib/cron-audit.ts at the success path of each cron route.
          A cron with `latestAt = null` (no row in 24h) is the loudest
          signal — its scheduled job has been silent. */}
      <section className="mt-6 rounded-lg border">
        <header className="border-b bg-muted/20 px-4 py-2.5">
          <h2 className="text-base font-medium">Cron run status (24h)</h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Each scheduled job in{" "}
            <code className="rounded bg-muted px-1 py-0.5">vercel.json</code>{" "}
            writes a `cron.run` audit row at the end of its handler. A
            row missing here means that cron hasn&apos;t executed in the
            last 24 hours.
          </p>
        </header>
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Cron</th>
              <th className="px-3 py-2 font-medium">Last run (JST)</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium tabular-nums">
                Duration (ms)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {cronSummaries.map((s) => (
              <tr
                key={s.cron}
                className={
                  s.latestAt === null
                    ? "bg-amber-50 dark:bg-amber-950/20"
                    : s.ok === false
                      ? "bg-rose-50 dark:bg-rose-950/20"
                      : ""
                }
              >
                <td className="px-3 py-2 font-mono">{s.cron}</td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {s.latestAt
                    ? new Intl.DateTimeFormat("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(s.latestAt)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {s.latestAt === null ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      missing
                    </span>
                  ) : s.ok === false ? (
                    <span className="text-rose-700 dark:text-rose-300">
                      failed{s.error ? ` · ${s.error}` : ""}
                    </span>
                  ) : (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      ok
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono tabular-nums">
                  {s.durationMs ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="mt-8 text-xs text-muted-foreground">
        Helpers:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/lib/health-check.ts
        </code>{" "}
        ·{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/lib/cron-audit.ts
        </code>{" "}
        ·{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/lib/sentry-incidents.ts
        </code>{" "}
        · Audit verbs:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          admin.health.viewed
        </code>{" "}
        +{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">cron.run</code>
      </footer>
    </main>
  );
}

/**
 * Map storage-monitor's StorageStatus (`ok | warn | critical`) onto the
 * StatusBadge's HealthStatus (`ok | degraded | failed`). The two
 * vocabularies serve different surfaces (live probe vs storage usage
 * threshold) so they stay distinct types — this adapter renders the
 * storage-side semantics in the same badge component without
 * widening the StatusBadge contract.
 */
function mapStorageToHealth(s: StorageStatus): HealthStatus {
  if (s === "critical") return "failed";
  if (s === "warn") return "degraded";
  return "ok";
}

function StatusBadge({
  status,
  note,
}: {
  status: HealthStatus;
  note?: string | null;
}) {
  const cls =
    status === "ok"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "degraded"
        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${cls}`}
    >
      <span aria-hidden="true">●</span>
      {status}
      {note ? <span className="font-normal normal-case opacity-70">· {note}</span> : null}
    </span>
  );
}

function EnvProbeCard({
  name,
  probe,
  note,
}: {
  name: string;
  probe: EnvProbeResult;
  note: string;
}) {
  const status: HealthStatus = probe.present
    ? probe.missingHint
      ? "degraded"
      : "ok"
    : "failed";
  return (
    <article className="rounded-lg border p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-medium">{name}</h2>
        <StatusBadge
          status={status}
          note={
            status === "ok"
              ? "env present"
              : status === "degraded"
                ? "partial"
                : "missing"
          }
        />
      </div>
      <p className="text-xs text-foreground/80">
        {probe.missingHint ?? "All required env vars are configured."}
      </p>
      <p className="mt-2 text-[11px] text-muted-foreground">{note}</p>
    </article>
  );
}
