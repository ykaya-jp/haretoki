/**
 * Phase 4 launch-readiness — Sentry incident counter for /admin/health.
 *
 * Calls the Sentry REST API for the project's `events-stats` endpoint
 * to count "error" + "warning" level events in the last 24h. Falls
 * back gracefully when:
 *
 *   - SENTRY_AUTH_TOKEN is unset (CI / dev) → returns null counts +
 *     a hint to check the dashboard manually
 *   - The REST call fails / times out → returns null counts + the
 *     error string (best-effort, never throws)
 *
 * Why server-side fetch instead of a client SDK widget:
 *   - We render this on a Server Component dashboard that already
 *     uses `connection()` per-request. Adding a client-side Sentry
 *     widget would mean one more JS chunk on the public bundle and
 *     would leak the Sentry org / project to the browser.
 *   - Server-side keeps SENTRY_AUTH_TOKEN secret + the request
 *     happens once per page load (or per auto-refresh tick).
 *
 * Rate-limit awareness: Sentry's REST API is 40 req/sec at the org
 * level by default. With 5-min auto-refresh on /admin/health, even a
 * pool of operators all open simultaneously can't approach the cap.
 * We don't add our own throttle.
 */

export interface SentryIncidentsSnapshot {
  /** True when SENTRY_AUTH_TOKEN + ORG + PROJECT are all set. */
  configured: boolean;
  /** Errors in the last 24h, or null when the probe couldn't run. */
  errorCount: number | null;
  /** Warnings in the last 24h, or null when the probe couldn't run. */
  warningCount: number | null;
  /** Failure description, null on success / not-configured. */
  error: string | null;
  /** Direct link to the Sentry issues view for this project. Always
   *  populated when ORG + PROJECT are present so the operator can
   *  click through even if the count probe fails. */
  dashboardUrl: string | null;
}

const PROBE_TIMEOUT_MS = 5_000;

/**
 * Build the Sentry REST API URL for issue stats. The
 * `events-stats?statsPeriod=24h&yAxis=count()` endpoint returns a
 * time-series, but we just need the sum — `query` filters on
 * `level:error` or `level:warning`.
 */
function buildStatsUrl(
  org: string,
  project: string,
  level: "error" | "warning",
): string {
  const params = new URLSearchParams({
    statsPeriod: "24h",
    project,
    query: `level:${level}`,
    yAxis: "count()",
    interval: "1h",
  });
  return `https://sentry.io/api/0/organizations/${org}/events-stats/?${params}`;
}

function buildDashboardUrl(org: string, project: string): string {
  return `https://sentry.io/organizations/${org}/issues/?project=${project}&statsPeriod=24h`;
}

/**
 * Fetch a Sentry stats endpoint and sum the time-series values into
 * a single 24h count. Returns null on any failure (no throw).
 */
async function fetchLevelCount(
  url: string,
  token: string,
): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    // Sentry returns `{ data: [[ts, [{count: N}]], ...] }` for
    // events-stats. Sum the inner counts; defensively handle shape
    // variation by zero-defaulting any field we can't read.
    if (
      typeof body !== "object" ||
      body === null ||
      !("data" in body) ||
      !Array.isArray((body as { data: unknown }).data)
    ) {
      return null;
    }
    const data = (body as { data: Array<[number, Array<{ count?: number }>]> })
      .data;
    let total = 0;
    for (const point of data) {
      const inner = point?.[1];
      if (Array.isArray(inner)) {
        for (const slot of inner) {
          if (typeof slot?.count === "number") total += slot.count;
        }
      }
    }
    return total;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSentryIncidents(): Promise<SentryIncidentsSnapshot> {
  const token = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!org || !project) {
    return {
      configured: false,
      errorCount: null,
      warningCount: null,
      error: "SENTRY_ORG / SENTRY_PROJECT not set",
      dashboardUrl: null,
    };
  }

  const dashboardUrl = buildDashboardUrl(org, project);

  if (!token) {
    return {
      configured: false,
      errorCount: null,
      warningCount: null,
      error: "SENTRY_AUTH_TOKEN not set — counts unavailable, dashboard link only",
      dashboardUrl,
    };
  }

  const [errorCount, warningCount] = await Promise.all([
    fetchLevelCount(buildStatsUrl(org, project, "error"), token),
    fetchLevelCount(buildStatsUrl(org, project, "warning"), token),
  ]);

  const probeFailed = errorCount === null && warningCount === null;
  return {
    configured: true,
    errorCount,
    warningCount,
    error: probeFailed ? "Sentry REST probe failed — see dashboard" : null,
    dashboardUrl,
  };
}
