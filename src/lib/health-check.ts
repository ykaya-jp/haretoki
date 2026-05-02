/**
 * Pure helpers for the health-check cron + /admin/health view.
 *
 * Lives in `lib/` (no Prisma / no fetch) so spec runners can pin the
 * latency thresholds + env-presence rules without standing up the
 * runtime. The cron route + admin page each consume these to make
 * "is this service alive?" decisions.
 *
 * Born from the 2026-05-03 prod incident: Supabase free-tier paused
 * after 7 days of inactivity → all auth requests returned "Invalid
 * API key" → blank screen. The cron at /api/cron/supabase-health
 * fires once daily to keep the project warm; this module is the
 * shared math.
 */

/**
 * Health classification per service. Thresholds picked from the
 * 2026-05-03 incident analysis:
 *
 *   - `ok` (≤ 800ms): nominal — a healthy Supabase REST query lands
 *     in <300ms, even cold-start adds <300ms. Anything ≤ 800ms is
 *     within natural variance.
 *   - `degraded` (≤ 3000ms): slow but not dead. Could be cold start
 *     after auto-pause OR a regional Vercel↔Supabase hiccup. Still
 *     responding, so the user-facing app probably works; alert the
 *     operator at p3-digest level.
 *   - `failed` (> 3000ms or no response): treat as a probable
 *     auto-pause / outage. Alert at p2-email so on-call notices.
 */
export type HealthStatus = "ok" | "degraded" | "failed";

export const HEALTH_OK_THRESHOLD_MS = 800;
export const HEALTH_DEGRADED_THRESHOLD_MS = 3000;
/**
 * Hard request timeout for the live probe. Beyond this we abort and
 * classify as `failed` regardless — the user-perceived "blank screen"
 * incident lasted ~3 minutes, so a 5s probe is generous enough to
 * distinguish "slow but live" from "dead".
 */
export const HEALTH_PROBE_TIMEOUT_MS = 5000;

/**
 * Classify a measured latency. `null` (no measurement) maps to
 * `failed` so the caller doesn't have to special-case the "fetch
 * threw" branch — it can just report the result.
 */
export function classifyLatency(ms: number | null): HealthStatus {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "failed";
  if (ms <= HEALTH_OK_THRESHOLD_MS) return "ok";
  if (ms <= HEALTH_DEGRADED_THRESHOLD_MS) return "degraded";
  return "failed";
}

export type ServiceKey =
  | "supabase"
  | "vercel"
  | "anthropic"
  | "resend";

/**
 * Env-only probe — does the operator have credentials configured for
 * this service? Used by /admin/health for services we don't ping
 * live (Anthropic per-call cost is non-trivial; Resend webhook health
 * is observable via webhook-ops.md SQL queries instead). Returns a
 * stable shape for the UI table even when keys are absent.
 */
export interface EnvProbeResult {
  /** Display-friendly label for the operator UI. */
  label: string;
  /** True if all required env vars are present. */
  present: boolean;
  /** What the operator should set if `present` is false. */
  missingHint: string | null;
}

export function probeSupabaseEnv(): EnvProbeResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const present = Boolean(url && anon);
  return {
    label: "Supabase",
    present,
    missingHint: present
      ? null
      : "set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
  };
}

export function probeVercelEnv(): EnvProbeResult {
  // Vercel always sets these on its own runtime — absence means
  // "running outside Vercel" (local / preview without Vercel) which
  // is a normal state, NOT an error. Report present=true so the
  // /admin/health row reads green when local, but expose the SHA
  // so the operator can correlate to a deployment.
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  return {
    label: "Vercel",
    present: true,
    missingHint:
      sha === undefined
        ? "running outside Vercel (no VERCEL_GIT_COMMIT_SHA — local / non-Vercel host)"
        : null,
  };
}

export function probeAnthropicEnv(): EnvProbeResult {
  const key = process.env.ANTHROPIC_API_KEY;
  const disabled = process.env.DISABLE_AI;
  // DISABLE_AI=1 is a deliberate operational choice (e.g. budget
  // exhaustion mid-month). Report present=true so the row doesn't
  // alarm the operator — AI surfaces will fall back gracefully — but
  // surface the disable in the hint.
  if (disabled) {
    return {
      label: "Anthropic",
      present: true,
      missingHint: "DISABLE_AI=1 — AI surfaces are intentionally off",
    };
  }
  return {
    label: "Anthropic",
    present: Boolean(key),
    missingHint: key ? null : "set ANTHROPIC_API_KEY",
  };
}

export function probeResendEnv(): EnvProbeResult {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  // API key is the floor — without it nothing sends. Webhook secret
  // is required for delivery tracking; missing it isn't a hard fail
  // but degrades observability, so we surface it in the hint.
  if (!apiKey) {
    return {
      label: "Resend",
      present: false,
      missingHint: "set RESEND_API_KEY",
    };
  }
  return {
    label: "Resend",
    present: true,
    missingHint: webhookSecret
      ? null
      : "RESEND_WEBHOOK_SECRET unset — delivery tracking is off",
  };
}

/**
 * Build the URL for the live Supabase ping. We hit `/auth/v1/health`
 * because:
 *   - it's a GET, no body, no row read → cheapest possible request
 *   - it requires `apikey` header validation, so a paused project
 *     correctly returns 401, not 200 with a "paused" message body
 *     that we'd have to parse
 *   - it bypasses RLS entirely — no risk of a future RLS change
 *     making our health probe return 0 rows
 *
 * Falls back to `/rest/v1/` (which hits the same gate) when the
 * caller passes an explicit override for testing.
 */
export function buildSupabaseHealthUrl(supabaseUrl: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/auth/v1/health`;
}

/**
 * Bundle of (status, latency) the cron persists / the admin view
 * renders. `latencyMs = null` means we never got a response — the
 * abort fired or the network rejected the request. Classified by
 * `classifyLatency` so the UI doesn't have to know the thresholds.
 */
export interface ProbeResult {
  service: ServiceKey;
  status: HealthStatus;
  latencyMs: number | null;
  /** HTTP status code if we got one — null on network-level failure. */
  statusCode: number | null;
  /** Short error description for the alert payload. Always English so
   *  it's grep-friendly in Sentry; the user UI uses the localised
   *  status badge instead. */
  error: string | null;
}
