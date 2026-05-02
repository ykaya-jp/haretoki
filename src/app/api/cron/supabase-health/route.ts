import { NextResponse } from "next/server";
import {
  buildSupabaseHealthUrl,
  classifyLatency,
  HEALTH_PROBE_TIMEOUT_MS,
} from "@/lib/health-check";
import { captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import { recordCronRun } from "@/lib/cron-audit";

/**
 * GET|POST /api/cron/supabase-health
 *
 * Daily ping to keep the Supabase free-tier project warm. Born from
 * the 2026-05-03 prod incident — Supabase auto-paused after 7 days
 * of inactivity, all auth requests returned "Invalid API key", users
 * saw a blank screen for ~3 minutes until manual restore.
 *
 * Mechanism: 1 GET to `/auth/v1/health` (cheapest possible request
 * that still touches the server tier — see `health-check.ts` for the
 * URL choice rationale). Doing this once a day:
 *   - resets the "no inbound traffic" timer that triggers auto-pause
 *   - measures end-to-end latency, so a degradation is visible in
 *     the log stream before it becomes a user-facing outage
 *
 * Auth: Bearer CRON_SECRET (matches the seven sibling crons).
 *
 * Failure protocol — this is a Sentry-driven alert, not a hard fail:
 *   - status `ok`        → logEvent only, no alert
 *   - status `degraded`  → captureMessage warning at p3-digest level
 *     (degraded reads of >800ms but ≤3s — slow but live)
 *   - status `failed`    → captureMessage warning at p2-email level
 *     (no response within 5s OR HTTP failure — likely auto-pause OR
 *     upstream outage; on-call should look)
 *
 * The cron itself never returns non-2xx so Vercel's "cron failed"
 * email doesn't fire spuriously when Supabase is just slow — Sentry
 * is the alert surface, not the cron exit code.
 */
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  // Phase 4 launch-readiness — wall-time for the cron run is measured
  // from the auth gate forward (excludes the trivial config check) so
  // /admin/health's "duration" column reflects the actual probe time.
  const start = Date.now();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    // Operator misconfig — alert at p2 so on-call notices, but return
    // 200 so Vercel cron history shows green (a missing env var isn't
    // a CRON failure, it's a deploy-config gap).
    captureMessage("[cron.health] Supabase env not configured", {
      level: "warning",
      component: "cron.health",
      alertRoute: "p2-email",
      extra: { action: "supabase-health:env-missing" },
    });
    await recordCronRun("supabase-health", {
      ok: false,
      durationMs: Date.now() - start,
      error: "env-missing",
    });
    return NextResponse.json({ ok: false, reason: "env-missing" });
  }

  const url = buildSupabaseHealthUrl(supabaseUrl);
  const probe = await timedFetch(url, anonKey);
  const status = classifyLatency(probe.latencyMs);

  logEvent({
    event: "supabase_health_check",
    fields: {
      status,
      latencyMs: probe.latencyMs,
      statusCode: probe.statusCode,
      probeUrl: url,
      // Don't log the anon key. The `apikey` header is sent on the
      // wire but never written to logs.
      hadError: probe.error !== null,
    },
  });

  if (status === "degraded") {
    captureMessage("[cron.health] Supabase probe degraded", {
      level: "warning",
      component: "cron.health",
      alertRoute: "p3-digest",
      extra: {
        latencyMs: probe.latencyMs,
        statusCode: probe.statusCode,
      },
    });
  } else if (status === "failed") {
    // Likely auto-pause OR upstream outage. Bumping to p2-email so the
    // operator sees it within the daily digest cycle. Not p1-page
    // because the daily ping is a leading indicator, not a user-
    // visible outage by itself — auth failures from real users would
    // hit Sentry separately at p1.
    captureMessage("[cron.health] Supabase probe failed", {
      level: "warning",
      component: "cron.health",
      alertRoute: "p2-email",
      extra: {
        latencyMs: probe.latencyMs,
        statusCode: probe.statusCode,
        error: probe.error,
        runbook: "docs/harness/supabase-auto-pause-prevention.md",
      },
    });
  }

  await recordCronRun("supabase-health", {
    ok: status !== "failed",
    durationMs: Date.now() - start,
    ...(status === "failed" && probe.error ? { error: probe.error } : {}),
  });
  return NextResponse.json({
    ok: true,
    status,
    latencyMs: probe.latencyMs,
    statusCode: probe.statusCode,
  });
}

/**
 * Probe with a hard timeout. Returns latency + statusCode + error
 * description; never throws. The 5s timeout is enforced via
 * `AbortController` rather than `Promise.race` so the underlying
 * fetch is genuinely cancelled (not just orphaned).
 */
async function timedFetch(
  url: string,
  anonKey: string,
): Promise<{
  latencyMs: number | null;
  statusCode: number | null;
  error: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    HEALTH_PROBE_TIMEOUT_MS,
  );
  // React Compiler flags Date.now() impure-during-render; we're in a
  // route handler where per-request semantics are exactly what we want.
  const start = Date.now();
  try {
    const response = await fetch(url, {
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
      latencyMs,
      statusCode: response.status,
      error: response.ok
        ? null
        : `HTTP ${response.status}`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    if (err instanceof Error && err.name === "AbortError") {
      return {
        latencyMs: null,
        statusCode: null,
        error: `timeout after ${HEALTH_PROBE_TIMEOUT_MS}ms`,
      };
    }
    return {
      latencyMs,
      statusCode: null,
      error: err instanceof Error ? err.message : "unknown fetch error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
