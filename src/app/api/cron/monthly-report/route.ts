import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { sendEmail, isEmailAvailable } from "@/lib/email/send";
import { captureError, captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import { recordCronRun } from "@/lib/cron-audit";
import {
  isFirstOfUtcMonth,
  previousMonthWindow,
  computeActivityWindows,
  computeDecisionRate,
  computePartnerAdoptionRate,
} from "@/lib/metrics-aggregations";

/**
 * GET|POST /api/cron/monthly-report
 *
 * Daily cron schedule (Hobby plan compatible) that internal-gates on
 * `now.getUTCDate() === 1` so the actual report only fires once a
 * month. Vercel Hobby restricts to daily granularity, so a true
 * `0 6 1 * *` (= "06:00 UTC on day 1 of month") would be rejected;
 * the runtime gate gives the same effect with a daily schedule.
 *
 * Sends a monthly KPI summary email to MONTHLY_REPORT_EMAIL (fallback:
 * admin@haretoki.app) covering the *previous* calendar month.
 *
 * Auth: Bearer CRON_SECRET (matches the sibling crons).
 *
 * Failure protocol — Sentry-driven, never returns non-2xx so the
 * Vercel cron history stays green:
 *   - day-of-month != 1 → silent no-op + logEvent (skipped)
 *   - email infra unavailable → captureMessage warning at p3-digest,
 *     return ok+sent=false (operator notices via the Sentry digest)
 *   - sendEmail failure → captureError at p2-email, return ok+sent=false
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
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
  const now = new Date();

  // Day-of-month gate. Daily schedule means we get hit 30+ times a
  // month; the report should only fire on day 1.
  if (!isFirstOfUtcMonth(now)) {
    logEvent({
      event: "monthly_report_skipped",
      fields: { reason: "not-day-1", utcDate: now.getUTCDate() },
    });
    await recordCronRun("monthly-report", {
      ok: true,
      durationMs: Date.now() - start,
    });
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "not-day-1",
      utcDate: now.getUTCDate(),
    });
  }

  const window = previousMonthWindow(now);
  const summary = await buildMonthlySummary(window.start, window.end);

  const inbox = process.env.MONTHLY_REPORT_EMAIL ?? "admin@haretoki.app";

  if (!isEmailAvailable()) {
    captureMessage(
      "[cron.monthly-report] email infra unavailable, report not sent",
      {
        level: "warning",
        component: "cron.health",
        alertRoute: "p3-digest",
        extra: { monthLabel: window.monthLabel, summary },
      },
    );
    await recordCronRun("monthly-report", {
      ok: true,
      durationMs: Date.now() - start,
    });
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: "email-unavailable",
      summary,
    });
  }

  const rendered = renderMonthlyReportEmail({
    monthLabel: window.monthLabel,
    summary,
  });

  let sent = false;
  try {
    const result = await sendEmail({
      to: inbox,
      subject: `[Haretoki Monthly Report] ${window.monthLabel}`,
      html: rendered.html,
      text: rendered.text,
    });
    sent = result.success;
    if (!result.success) {
      captureError(new Error(`monthly-report sendEmail failed: ${result.error ?? "unknown"}`), {
        component: "cron.health",
        alertRoute: "p2-email",
        extra: { monthLabel: window.monthLabel, error: result.error },
      });
    }
  } catch (err) {
    captureError(err, {
      component: "cron.health",
      alertRoute: "p2-email",
      extra: { action: "monthly-report:send", monthLabel: window.monthLabel },
    });
  }

  logEvent({
    event: "monthly_report_sent",
    fields: { monthLabel: window.monthLabel, sent, ...summary },
  });

  await recordCronRun("monthly-report", {
    ok: sent,
    durationMs: Date.now() - start,
  });

  return NextResponse.json({
    ok: true,
    sent,
    monthLabel: window.monthLabel,
    summary,
  });
}

interface MonthlySummary {
  newUsers: number;
  newProjects: number;
  newDecisions: number;
  partnerAdoptionPct: number;
  decisionRatePct: number;
  monthlyAiCostUsd: number;
  monthlyAiCostBudgetUsd: number;
  pushSends: number;
  visitReminders: number;
  feedbackSubmissions: number;
  cronFailures: number;
  /** Distinct user IDs from notifications + audit_logs in the window. */
  monthlyActiveUsersLowerBound: number;
}

async function buildMonthlySummary(start: Date, end: Date): Promise<MonthlySummary> {
  const [
    newUsers,
    newProjects,
    newDecisions,
    totalProjects,
    totalDecisions,
    membersWithAccept,
    audit,
    notif,
    pushSends,
    visitReminders,
    feedbackSubmissions,
    cronFailureRows,
    latestCostSnapshot,
  ] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.project.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.decision.count({ where: { decidedAt: { gte: start, lt: end } } }),
    prisma.project.count({ where: { createdAt: { lt: end } } }),
    prisma.decision.count({ where: { decidedAt: { lt: end } } }),
    prisma.projectMember.findMany({
      where: { acceptedAt: { not: null, lt: end } },
      select: { projectId: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { actorId: true },
      take: 50000,
    }),
    prisma.notification.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { userId: true },
      take: 50000,
    }),
    prisma.pushSendLog.count({ where: { sentAt: { gte: start, lt: end } } }),
    prisma.visitReminderSent.count({ where: { sentAt: { gte: start, lt: end } } }),
    prisma.auditLog.count({
      where: {
        action: "user.feedback.submitted",
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: "cron.run", createdAt: { gte: start, lt: end } },
      select: { detail: true },
      take: 5000,
    }),
    prisma.aiCostSnapshot.findFirst({
      where: { snapshotDate: { lt: end } },
      orderBy: { snapshotDate: "desc" },
      select: { monthlyUsedUsd: true, monthlyBudgetUsd: true },
    }),
  ]);

  const projectMemberCount = new Map<string, number>();
  for (const m of membersWithAccept) {
    projectMemberCount.set(
      m.projectId,
      (projectMemberCount.get(m.projectId) ?? 0) + 1,
    );
  }
  const projectsWithPartner = Array.from(projectMemberCount.values()).filter(
    (n) => n >= 2,
  ).length;

  const partnerAdoption = computePartnerAdoptionRate({
    totalProjects,
    projectsWithPartner,
  });
  const decisionRate = computeDecisionRate({
    totalProjects,
    totalDecisions,
  });

  const userIds = [
    ...audit.map((r) => r.actorId).filter((id): id is string => Boolean(id)),
    ...notif.map((r) => r.userId).filter((id): id is string => Boolean(id)),
  ];
  const activity = computeActivityWindows({
    dayUserIds: [],
    weekUserIds: [],
    monthUserIds: userIds,
  });

  const cronFailures = cronFailureRows.filter((row) => {
    const detail = row.detail as { ok?: boolean } | null;
    return detail?.ok === false;
  }).length;

  return {
    newUsers,
    newProjects,
    newDecisions,
    partnerAdoptionPct: partnerAdoption.ratePct,
    decisionRatePct: decisionRate.ratePct,
    monthlyAiCostUsd: latestCostSnapshot
      ? Number(latestCostSnapshot.monthlyUsedUsd)
      : 0,
    monthlyAiCostBudgetUsd: latestCostSnapshot
      ? Number(latestCostSnapshot.monthlyBudgetUsd)
      : 0,
    pushSends,
    visitReminders,
    feedbackSubmissions,
    cronFailures,
    monthlyActiveUsersLowerBound: activity.mau,
  };
}

function renderMonthlyReportEmail(opts: {
  monthLabel: string;
  summary: MonthlySummary;
}): { html: string; text: string } {
  const s = opts.summary;
  const html = `<!doctype html>
<html lang="ja"><body style="font-family:system-ui,-apple-system,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;line-height:1.7;color:#1f1a17;">
<h1 style="margin:0 0 16px 0;font-weight:400;">Haretoki Monthly Report — ${opts.monthLabel}</h1>
<p style="margin:0 0 16px 0;font-size:12px;color:#7a6e64;">期間: ${opts.monthLabel} 全月 (UTC)。 数値の出所と精度は <code>src/lib/metrics-aggregations.ts</code> の inline doc を参照。</p>

<h2 style="margin:24px 0 8px 0;font-weight:400;font-size:15px;">Cohort growth</h2>
<table style="border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">new users</td><td style="font-family:monospace;">${s.newUsers}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">new projects</td><td style="font-family:monospace;">${s.newProjects}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">new decisions</td><td style="font-family:monospace;">${s.newDecisions}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">monthly active (lower bound)</td><td style="font-family:monospace;">${s.monthlyActiveUsersLowerBound}</td></tr>
</table>

<h2 style="margin:24px 0 8px 0;font-weight:400;font-size:15px;">Funnel quality</h2>
<table style="border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">partner adoption rate (cumulative)</td><td style="font-family:monospace;">${s.partnerAdoptionPct}%</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">decision rate (cumulative)</td><td style="font-family:monospace;">${s.decisionRatePct}%</td></tr>
</table>

<h2 style="margin:24px 0 8px 0;font-weight:400;font-size:15px;">Operations</h2>
<table style="border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">push notifications sent</td><td style="font-family:monospace;">${s.pushSends}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">visit reminders sent</td><td style="font-family:monospace;">${s.visitReminders}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">Beta feedback submissions</td><td style="font-family:monospace;">${s.feedbackSubmissions}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">cron failures (audit)</td><td style="font-family:monospace;">${s.cronFailures}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#7a6e64;">AI cost (latest snapshot)</td><td style="font-family:monospace;">$${s.monthlyAiCostUsd.toFixed(2)} / $${s.monthlyAiCostBudgetUsd.toFixed(0)} budget</td></tr>
</table>

<hr style="border:0;border-top:1px solid #e6dfd6;margin:24px 0 12px 0;"/>
<p style="font-size:11px;color:#a89c91;">Auto-generated by /api/cron/monthly-report. /admin/metrics has the live equivalents. Drift between this email and /admin/metrics likely means activity in the gap between cron fire (UTC 06:00 day 1) and report read time.</p>
</body></html>`;

  const text = `Haretoki Monthly Report — ${opts.monthLabel}

[Cohort growth]
new users: ${s.newUsers}
new projects: ${s.newProjects}
new decisions: ${s.newDecisions}
monthly active (lower bound): ${s.monthlyActiveUsersLowerBound}

[Funnel quality]
partner adoption rate (cumulative): ${s.partnerAdoptionPct}%
decision rate (cumulative): ${s.decisionRatePct}%

[Operations]
push notifications sent: ${s.pushSends}
visit reminders sent: ${s.visitReminders}
Beta feedback submissions: ${s.feedbackSubmissions}
cron failures (audit): ${s.cronFailures}
AI cost (latest snapshot): $${s.monthlyAiCostUsd.toFixed(2)} / $${s.monthlyAiCostBudgetUsd.toFixed(0)} budget

---
Auto-generated by /api/cron/monthly-report. /admin/metrics has the live equivalents.
`;

  return { html, text };
}
