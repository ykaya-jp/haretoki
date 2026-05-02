import { connection } from "next/server";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";
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

  // Run the live probe + env probes in parallel — env probes are
  // synchronous so this is mostly waiting on the Supabase fetch.
  const [liveSupabase, envSupabase, envVercel, envAnthropic, envResend] =
    await Promise.all([
      liveProbeSupabase(),
      Promise.resolve(probeSupabaseEnv()),
      Promise.resolve(probeVercelEnv()),
      Promise.resolve(probeAnthropicEnv()),
      Promise.resolve(probeResendEnv()),
    ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Health Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
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

      <footer className="mt-8 text-xs text-muted-foreground">
        Helpers:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/lib/health-check.ts
        </code>{" "}
        · Cron:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          /api/cron/supabase-health
        </code>{" "}
        (daily) · Audit verb:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          admin.health.viewed
        </code>
      </footer>
    </main>
  );
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
