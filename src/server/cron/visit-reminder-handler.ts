/**
 * Shared visit-reminder cron handler. Both
 * `/api/cron/visit-reminders-day-before` and
 * `/api/cron/visit-reminders-morning-of` are thin wrappers around this
 * function — the route file pins the phase, the handler does fan-out.
 *
 * Keeping the orchestration here (instead of duplicating it across two
 * route handlers) means a future bug fix or telemetry change only edits
 * one file. Route handlers stay 25 lines of auth + delegate.
 */

import { prisma } from "@/server/db";
import { isEmailAvailable, sendEmail } from "@/lib/email/send";
import { renderVisitReminderEmail } from "@/lib/email/templates/visit-reminder";
import { captureError, captureMessage } from "@/lib/sentry";
import {
  isVisitInPhaseWindow,
  visitReminderType,
  type VisitReminderPhase,
} from "@/lib/visit-reminders";

export interface CronResult {
  ok: true;
  durationMs: number;
  candidates: number;
  notified: number;
  emailed: number;
  skipped: number;
  /**
   * Per-visit work that threw inside the loop. Each one is also reported
   * to Sentry with the visitId and phase as scope context. Non-zero here
   * means the cron ran to completion but at least one couple may not have
   * received their reminder — investigate the Sentry event before the
   * next cron tick.
   */
  errored: number;
  /**
   * Resend `sendEmail` returned `success: false`. Common causes: domain
   * not verified, recipient bounced, rate limit. The Notification row is
   * still created (in-app delivery is independent), so this counter
   * isolates the email-only failure mode.
   */
  emailFailed: number;
}

/**
 * Candidate window. day_before fires at 19 JST evening; the following
 * morning's visits are 11-37h ahead. morning_of fires at 8 JST morning;
 * today's visits are 0-16h ahead. 50h ceiling generously brackets both
 * with margin for clock skew, while keeping the candidate set small.
 */
const CANDIDATE_WINDOW_MS = 50 * 60 * 60 * 1000;

export async function runVisitReminderCron(
  phase: VisitReminderPhase,
  now: Date = new Date(),
): Promise<CronResult> {
  const start = Date.now();
  const windowEnd = new Date(now.getTime() + CANDIDATE_WINDOW_MS);

  const candidates = await prisma.visit.findMany({
    where: {
      status: "scheduled",
      deletedAt: null,
      scheduledAt: { gt: now, lte: windowEnd },
    },
    select: {
      id: true,
      scheduledAt: true,
      title: true,
      memo: true,
      venueId: true,
      venue: {
        select: {
          id: true,
          name: true,
          accessInfo: true,
          projectId: true,
        },
      },
    },
  });

  let notified = 0;
  let emailed = 0;
  let skipped = 0;
  let errored = 0;
  let emailFailed = 0;

  // Site origin for the in-email venue link. Falls back to a relative
  // path if neither env var is set so the email still renders (most
  // clients tolerate relative hrefs).
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "";

  for (const visit of candidates) {
    if (!visit.scheduledAt) {
      skipped++;
      continue;
    }
    if (!isVisitInPhaseWindow(phase, { scheduledAt: visit.scheduledAt, now })) {
      skipped++;
      continue;
    }

    // Wrap the per-visit work in try/catch so a single bad visit (FK
    // violation, transient DB blip, malformed venue row) doesn't unwind
    // the whole loop and starve subsequent couples of their reminder.
    // Each error is reported to Sentry with the (phase, visitId) scope
    // so on-call can pinpoint the root cause without digging through
    // raw logs.
    try {
      // Members + email + notification preferences in one round-trip per
      // visit. The set is small (typically 2 — owner + partner) so the
      // join overhead is negligible against Resend latency downstream.
      const members = await prisma.projectMember.findMany({
        where: {
          projectId: visit.venue.projectId,
          acceptedAt: { not: null },
        },
        select: {
          userId: true,
          user: {
            select: {
              email: true,
              notificationPreference: {
                select: { frequency: true, emailEnabled: true },
              },
            },
          },
        },
      });

      if (members.length === 0) {
        skipped++;
        continue;
      }

      const dedupeType = visitReminderType(phase, visit.id);
      const venueUrl = origin
        ? `${origin.replace(/\/$/, "")}/venues/${visit.venue.id}`
        : `/venues/${visit.venue.id}`;
      const rendered = renderVisitReminderEmail({
        phase,
        venueName: visit.venue.name,
        scheduledAt: visit.scheduledAt,
        accessInfo: visit.venue.accessInfo,
        memo: visit.memo,
        venueUrl,
      });

      for (const member of members) {
        const pref = member.user.notificationPreference;
        // "off" silences both in-app and email — same shape as the AI
        // insights frequency gate (`getAIInsights`).
        if (pref?.frequency === "off") {
          skipped++;
          continue;
        }

        // Per-user dedupe via Notification.type marker.
        // Composite type string gives exact-match lookup with no fuzzy
        // parsing. This is what protects us against the user editing the
        // visit (which doesn't mutate the marker) firing duplicate sends.
        const already = await prisma.notification.count({
          where: { userId: member.userId, type: dedupeType },
        });
        if (already > 0) {
          skipped++;
          continue;
        }

        await prisma.notification.create({
          data: {
            userId: member.userId,
            type: dedupeType,
            title: rendered.subject.replace(/（Haretoki）$/, "").trim(),
            body: visit.title
              ? `${visit.venue.name} — ${visit.title}`
              : visit.venue.name,
            href: `/venues/${visit.venue.id}`,
          },
        });
        notified++;

        const emailOk = pref?.emailEnabled ?? true;
        if (!emailOk || !isEmailAvailable() || !member.user.email) {
          continue;
        }

        const sent = await sendEmail({
          to: member.user.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        if (sent.success) {
          emailed++;
        } else {
          // Resend rejected the send (rate limit, domain unverified,
          // bounced address). The in-app Notification was already
          // committed above, so the user still sees the reminder; this
          // counter isolates the email-delivery failure mode for ops.
          emailFailed++;
          captureMessage("[visit-reminder] sendEmail failed", {
            level: "warning",
            extra: {
              phase,
              visitId: visit.id,
              venueId: visit.venue.id,
              error: sent.error,
            },
          });
        }
      }
    } catch (err) {
      errored++;
      captureError(err, {
        action: "visit-reminder-cron",
        phase,
        visitId: visit.id,
        venueId: visit.venue.id,
      });
    }
  }

  // Structured one-line tag log for Vercel log grep
  // (`grep "\\[visit-reminder\\]"`). The JSON return body only reaches
  // the caller of the route handler; this line lands in the Function
  // log stream regardless.
  console.info(
    `[visit-reminder] phase=${phase} candidates=${candidates.length} notified=${notified} emailed=${emailed} emailFailed=${emailFailed} errored=${errored} skipped=${skipped} durationMs=${Date.now() - start}`,
  );

  return {
    ok: true,
    durationMs: Date.now() - start,
    candidates: candidates.length,
    notified,
    emailed,
    skipped,
    errored,
    emailFailed,
  };
}
