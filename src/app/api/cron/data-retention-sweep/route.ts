import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { captureError } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import { recordCronRun } from "@/lib/cron-audit";

/**
 * GET|POST /api/cron/data-retention-sweep
 *
 * Daily rolling cleanup for the two append-only tables introduced in
 * the recent rounds:
 *
 *   - `AiCostSnapshot` (round 13) — daily Anthropic cost rollup.
 *     Useful for ~12 months of trend analysis; older snapshots can be
 *     dropped (the Anthropic admin dashboard remains the SoT for
 *     historical billing).
 *
 *   - `AuditLog` (round 15) — sensitive-operation trail. Same
 *     12-month horizon: anything older than a year is unlikely to be
 *     load-bearing for incident response, and keeping it forever
 *     creates a quietly-growing PII surface even after the per-row
 *     redaction (email hash + IP truncation).
 *
 * Auth: Bearer CRON_SECRET (matches the five sibling crons).
 *
 * Retention horizon is env-overridable via
 * `DATA_RETENTION_DAYS` (default 365) so ops can tighten or loosen
 * without a code deploy. Audit log entries with a `user.delete.*`
 * action are EXEMPT from the sweep — they're the durable record that
 * a GDPR erasure request was honoured, and may be needed years later
 * to answer "did we delete this account?".
 */

export const maxDuration = 60;

const DEFAULT_RETENTION_DAYS = 365;

function getRetentionDays(): number {
  const raw = process.env.DATA_RETENTION_DAYS;
  const n = raw ? Number(raw) : NaN;
  // Floor at 90 days — anything shorter risks losing a useful audit
  // window on a busy quarter; ceiling at 3650 (10 years) — beyond
  // that the operator should run a manual archive instead of a cron.
  if (!Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.min(Math.max(Math.floor(n), 90), 3650);
}

/**
 * Audit actions that survive the sweep regardless of age. Currently
 * limited to user-erasure events because a regulator might ask
 * "prove you deleted this account in 2027" in 2030. Adding more
 * exempt actions here is fine; removing them requires a careful
 * compliance review.
 */
const RETENTION_EXEMPT_ACTIONS = [
  "user.delete.requested",
  "user.delete.completed",
  "user.delete.failed",
];

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
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

  const start = Date.now();
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let snapshotsDeleted = 0;
  let auditDeleted = 0;
  let visitReminderSentDeleted = 0;
  let pushSendLogDeleted = 0;

  try {
    const snapResult = await prisma.aiCostSnapshot.deleteMany({
      where: { snapshotDate: { lt: cutoff } },
    });
    snapshotsDeleted = snapResult.count;
  } catch (err) {
    captureError(err, {
      component: "db",
      alertRoute: "p2-email",
      extra: { action: "data-retention-sweep:ai-cost" },
    });
  }

  try {
    const auditResult = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        action: { notIn: RETENTION_EXEMPT_ACTIONS },
      },
    });
    auditDeleted = auditResult.count;
  } catch (err) {
    captureError(err, {
      component: "db",
      alertRoute: "p2-email",
      extra: { action: "data-retention-sweep:audit-log" },
    });
  }

  // Track B-2: prune dedupe rows older than the cutoff. The visit-reminder
  // dispatcher only consults rows for upcoming/today visits, so anything
  // older than DATA_RETENTION_DAYS will never be looked up again. The
  // (sent_at) index on visit_reminder_sent makes this a fast range scan.
  try {
    const visitReminderResult = await prisma.visitReminderSent.deleteMany({
      where: { sentAt: { lt: cutoff } },
    });
    visitReminderSentDeleted = visitReminderResult.count;
  } catch (err) {
    captureError(err, {
      component: "db",
      alertRoute: "p2-email",
      extra: { action: "data-retention-sweep:visit-reminder-sent" },
    });
  }

  // P3 L3 W2: prune push throttle rows older than the cutoff. The
  // dispatcher's hour-bucket key is only consulted for current-hour
  // sends; rows past the cutoff carry no operational meaning. The
  // (sent_at) index on push_send_logs makes this a fast range scan.
  try {
    const pushSendLogResult = await prisma.pushSendLog.deleteMany({
      where: { sentAt: { lt: cutoff } },
    });
    pushSendLogDeleted = pushSendLogResult.count;
  } catch (err) {
    captureError(err, {
      component: "db",
      alertRoute: "p2-email",
      extra: { action: "data-retention-sweep:push-send-log" },
    });
  }

  const durationMs = Date.now() - start;
  logEvent({
    event: "data_retention_sweep",
    fields: {
      retentionDays,
      cutoffIsoDate: cutoff.toISOString(),
      snapshotsDeleted,
      auditDeleted,
      visitReminderSentDeleted,
      pushSendLogDeleted,
      exemptActions: RETENTION_EXEMPT_ACTIONS,
      durationMs,
    },
  });

  await recordCronRun("data-retention-sweep", { ok: true, durationMs });
  return NextResponse.json({
    ok: true,
    retentionDays,
    cutoffIsoDate: cutoff.toISOString(),
    snapshotsDeleted,
    auditDeleted,
    visitReminderSentDeleted,
    pushSendLogDeleted,
    durationMs,
  });
}
