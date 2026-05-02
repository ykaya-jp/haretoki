/**
 * Pure audit aggregation + anomaly helpers.
 *
 * Lives in `lib/` (not `server/`) so spec runners can import directly
 * without standing up Prisma. The /admin/audit page passes raw
 * AuditLog rows into these helpers and renders the result; the
 * helpers themselves do no I/O.
 *
 * Surfaces:
 *   - aggregateActionCounts: action → count rollup, used by the bar
 *     chart sidebar (replaces the old prisma.groupBy on the page so
 *     the math is testable).
 *   - aggregateDailyCounts: day → count timeline (UTC-day buckets)
 *     for the trend strip across the page header.
 *   - detectSuspiciousAuditPatterns: rule-based anomaly scan. Returns
 *     a small AuditAnomaly[] the page surfaces in a red banner.
 */

/** Minimal AuditLog projection these helpers need. */
export interface AuditRowLite {
  action: string;
  actorId: string;
  ipAddress: string | null;
  createdAt: Date;
}

export interface ActionCount {
  action: string;
  count: number;
}

/**
 * Group rows by `action` and sort descending. Stable on tie via the
 * insertion order of the underlying Map — prevents test flakes when
 * two actions share the same count.
 */
export function aggregateActionCounts(rows: AuditRowLite[]): ActionCount[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.action, (counts.get(r.action) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}

export interface DailyCount {
  /** UTC YYYY-MM-DD. */
  date: string;
  count: number;
}

/**
 * UTC-day bucket counts for the last `days` days, INCLUSIVE of today.
 * Result length = `days`; empty days are present with count=0 so the
 * timeline strip renders a continuous baseline (no visual gaps when
 * the operator just shipped a feature change).
 *
 * `now` is parameterised for tests — production passes `new Date()`.
 */
export function aggregateDailyCounts(
  rows: AuditRowLite[],
  options: { days: number; now?: Date },
): DailyCount[] {
  const days = Math.max(1, Math.floor(options.days));
  const now = options.now ?? new Date();

  // Build the empty timeline first so we can splat in counts. UTC
  // midnight buckets — mixing TZ here would yield off-by-one boxes
  // for operators outside UTC, which is not the bug this surface is
  // for.
  const buckets = new Map<string, number>();
  const todayKey = utcDateKey(now);
  for (let i = days - 1; i >= 0; i--) {
    const ts = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.set(utcDateKey(ts), 0);
  }

  for (const r of rows) {
    const key = utcDateKey(r.createdAt);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  const out: DailyCount[] = [];
  for (const [date, count] of buckets) {
    out.push({ date, count });
  }
  // Sort defensively (Map preserves insertion order so this is a
  // tautology in practice but cheap to keep).
  out.sort((a, b) => a.date.localeCompare(b.date));
  // Sanity: today must be the last entry.
  if (out[out.length - 1]?.date !== todayKey) {
    // Guard: if `now` somehow disagreed with the bucket (e.g. caller
    // passed an offset Date), drop a zero entry for today so the UI
    // strip still renders to the right edge.
    out.push({ date: todayKey, count: 0 });
  }
  return out;
}

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type AuditAnomalySeverity = "warning" | "critical";

export interface AuditAnomaly {
  /** Stable identifier — used as React key + Sentry tag. */
  id: string;
  severity: AuditAnomalySeverity;
  /** One-line operator-facing message. */
  summary: string;
  /** Optional drill-down hint — e.g. "filter actor=<id>". */
  hint?: string;
  /** Raw count that tripped the threshold. */
  count: number;
}

/**
 * Rule-based anomaly scan over the recent audit window. Rules are
 * intentionally simple — no statistical modelling, just thresholds the
 * on-call can reason about under stress.
 *
 *   - delete-failure-burst: any actorId that produced ≥ 5
 *     `user.delete.failed` rows inside one hour. Likely a bug
 *     in the delete pipeline OR a malicious script.
 *   - family-view-flood: any ipAddress (already coarsened to /24 by
 *     the redactor) that produced ≥ 10 `family.invitation.viewed`
 *     rows inside one hour. The C-1 application-layer rate limit
 *     caps this at 10/min, but a leaked URL fanned out across many
 *     end-users in the same household /24 can still trip this — the
 *     audit table is the durable record.
 *   - admin-view-burst: ≥ 20 `admin.audit.viewed` rows by one actor
 *     in one hour. Above noise floor — the operator might be
 *     legitimately scrolling, or someone with stolen admin creds
 *     is enumerating.
 *
 * Adding a rule = append one block + an inline why-this-rule comment.
 * Lifting a threshold = log the prior value in the commit message so
 * the on-call diff can recover the rationale.
 */
export function detectSuspiciousAuditPatterns(
  rows: AuditRowLite[],
  now: Date = new Date(),
): AuditAnomaly[] {
  const out: AuditAnomaly[] = [];
  const oneHourMs = 60 * 60 * 1000;
  const horizon = now.getTime() - oneHourMs;
  const recent = rows.filter((r) => r.createdAt.getTime() >= horizon);

  // Rule 1: delete-failure burst per actor.
  const deleteFailures = new Map<string, number>();
  for (const r of recent) {
    if (r.action !== "user.delete.failed") continue;
    deleteFailures.set(r.actorId, (deleteFailures.get(r.actorId) ?? 0) + 1);
  }
  for (const [actorId, count] of deleteFailures) {
    if (count >= 5) {
      out.push({
        id: `delete-failure-burst:${actorId}`,
        severity: "critical",
        summary: `1 actor が ${count} 回 user.delete.failed (1h 以内)`,
        hint: `?action=user.delete.failed&actor=${actorId}`,
        count,
      });
    }
  }

  // Rule 2: family-invitation view flood per IP.
  const familyViews = new Map<string, number>();
  for (const r of recent) {
    if (r.action !== "family.invitation.viewed") continue;
    if (!r.ipAddress) continue;
    familyViews.set(r.ipAddress, (familyViews.get(r.ipAddress) ?? 0) + 1);
  }
  for (const [ip, count] of familyViews) {
    if (count >= 10) {
      out.push({
        id: `family-view-flood:${ip}`,
        severity: "warning",
        summary: `1 IP (${ip}) から ${count} 回 family.invitation.viewed (1h 以内)`,
        hint: `?action=family.invitation.viewed`,
        count,
      });
    }
  }

  // Rule 3: admin-audit view burst per actor.
  const adminViews = new Map<string, number>();
  for (const r of recent) {
    if (r.action !== "admin.audit.viewed") continue;
    adminViews.set(r.actorId, (adminViews.get(r.actorId) ?? 0) + 1);
  }
  for (const [actorId, count] of adminViews) {
    if (count >= 20) {
      out.push({
        id: `admin-view-burst:${actorId}`,
        severity: "warning",
        summary: `admin が ${count} 回 audit ページを開いています (1h 以内)`,
        hint: `?action=admin.audit.viewed&actor=${actorId}`,
        count,
      });
    }
  }

  return out;
}

/**
 * Find the largest count in a series so the bar-chart renderer can
 * normalise widths to 100% without re-iterating. Returns 1 for empty
 * input (avoids division-by-zero in the renderer).
 */
export function maxCount(series: Array<{ count: number }>): number {
  let max = 0;
  for (const s of series) {
    if (s.count > max) max = s.count;
  }
  return max === 0 ? 1 : max;
}
