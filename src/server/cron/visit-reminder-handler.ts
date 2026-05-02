/**
 * Shared visit-reminder cron handler. The three cron route files
 * (`visit-reminders-day-before`, `-morning-of`, `-way-home`) are thin
 * wrappers around `runVisitReminderCron`; the route pins the phase and
 * this function does fan-out + dedupe + delivery.
 *
 * Track B-2 changes (delivered alongside push subscriptions):
 *   - Adds `way_home` (T+30m memo nudge, fires JST 22:00 on past-today
 *     visits).
 *   - Switches the per-user dedupe gate from a count-then-create on
 *     `Notification.type` (not race-safe) to a `prisma.create` on
 *     `VisitReminderSent` with @@unique([userId, visitId, phase,
 *     scheduledDateKey]) (P2002 catch — atomic). The dedupe key
 *     includes the JST date so a re-scheduled visit invalidates prior
 *     dedupe rows automatically.
 *   - Sends push alongside email. Push success / failure is tracked in
 *     the result object; a push failure NEVER blocks the email leg
 *     (independent surfaces).
 *   - Switches reminder copy from the email-only template to the B-0
 *     copy table (3 timings × 4 venue kinds). Email still uses the
 *     existing renderer for now — the in-app + push surfaces share the
 *     B-0 copy.
 */

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { isEmailAvailable, sendEmail } from "@/lib/email/send";
import { renderVisitReminderEmail } from "@/lib/email/templates/visit-reminder";
import { captureError, captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import {
  isVisitInPhaseWindow,
  jstDateKey,
  type VisitReminderPhase,
} from "@/lib/visit-reminders";
import {
  pickReminderCopy,
  pickVenueKind,
  TIMING_FOR_PHASE,
} from "@/lib/visit-reminder/copy";
import { sendPushToUser } from "@/lib/push/send";

export interface CronResult {
  ok: true;
  durationMs: number;
  candidates: number;
  notified: number;
  emailed: number;
  /** Per-user dedupe rows already present — no work to do. */
  skipped: number;
  /** Push fan-out aggregate. */
  pushed: number;
  pushPruned: number;
  pushTransient: number;
  /**
   * Per-visit work that threw inside the loop. Each one is also reported
   * to Sentry with the visitId and phase as scope context.
   */
  errored: number;
  /** Resend `sendEmail` returned `success: false`. */
  emailFailed: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Forward-looking phases (`day_before`, `morning_of`) only need ~50h of
 * future visits. The `way_home` phase looks at past-today visits — at
 * worst back to JST 00:00 today, which is ~22h ago when the 22:00 cron
 * fires. The candidate window for that phase is computed differently
 * below.
 */
const FUTURE_CANDIDATE_WINDOW_MS = 50 * HOUR_MS;
const PAST_CANDIDATE_WINDOW_MS = 30 * HOUR_MS;

export async function runVisitReminderCron(
  phase: VisitReminderPhase,
  now: Date = new Date(),
): Promise<CronResult> {
  const start = Date.now();
  const candidates = await loadCandidates(phase, now);

  let notified = 0;
  let emailed = 0;
  let skipped = 0;
  let pushed = 0;
  let pushPruned = 0;
  let pushTransient = 0;
  let errored = 0;
  let emailFailed = 0;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "";
  const timing = TIMING_FOR_PHASE[phase];

  for (const visit of candidates) {
    if (!visit.scheduledAt) {
      skipped++;
      continue;
    }
    if (!isVisitInPhaseWindow(phase, { scheduledAt: visit.scheduledAt, now })) {
      skipped++;
      continue;
    }

    try {
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

      const venueUrl = origin
        ? `${origin.replace(/\/$/, "")}/venues/${visit.venue.id}`
        : `/venues/${visit.venue.id}`;
      const renderedEmail = renderVisitReminderEmail({
        phase,
        venueName: visit.venue.name,
        scheduledAt: visit.scheduledAt,
        accessInfo: visit.venue.accessInfo,
        memo: visit.memo,
        venueUrl,
      });
      const venueKind = pickVenueKind(visit.venue.ceremonyStyles);
      const reminderCopy = pickReminderCopy({
        timing,
        venueKind,
        venueName: visit.venue.name,
      });
      const scheduledDateKey = jstDateKey(visit.scheduledAt);
      const pushUrl = pushTargetUrl(phase, visit.id, visit.venue.id);

      for (const member of members) {
        const pref = member.user.notificationPreference;
        // "off" silences in-app + email + push — same shape as the AI
        // insights frequency gate (`getAIInsights`).
        if (pref?.frequency === "off") {
          skipped++;
          continue;
        }

        // ---- Atomic dedupe gate ----
        // P2002 from the unique index = "another tick already booked this
        // (user, visit, phase, scheduledDateKey)". Silently skip — the
        // other tick already did the user's work.
        try {
          await prisma.visitReminderSent.create({
            data: {
              userId: member.userId,
              visitId: visit.id,
              phase,
              scheduledDateKey,
            },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            skipped++;
            continue;
          }
          throw err;
        }

        // In-app Notification row. Failure here is non-fatal — the
        // dedupe row was already committed so a future tick won't
        // re-attempt this user, but the email + push legs below still
        // run.
        const dedupeType = `visit_reminder_${phase}:${visit.id}:${scheduledDateKey}`;
        const notification = await prisma.notification
          .create({
            data: {
              userId: member.userId,
              type: dedupeType,
              title: reminderCopy.title,
              body: reminderCopy.body,
              href: pushUrl,
            },
            select: { id: true },
          })
          .catch((err) => {
            captureError(err, {
              component: "cron.visit-reminder",
              alertRoute: "p3-digest",
              extra: {
                action: "visit-reminder-cron:notification-create",
                phase,
                userId: member.userId,
                visitId: visit.id,
              },
            });
            return null as { id: string } | null;
          });
        if (notification) notified++;

        // ---- Push leg (independent of email) ----
        const pushResult = await sendPushToUser(member.userId, {
          title: reminderCopy.title,
          body: reminderCopy.body,
          url: pushUrl,
          tag: `visit-reminder:${visit.id}:${phase}`,
        }).catch((err) => {
          captureError(err, {
            component: "cron.visit-reminder",
            alertRoute: "p2-email",
            extra: {
              action: "visit-reminder-cron:push",
              phase,
              userId: member.userId,
              visitId: visit.id,
            },
          });
          return null;
        });
        if (pushResult) {
          pushed += pushResult.succeeded;
          pushPruned += pushResult.pruned;
          pushTransient += pushResult.transient;
        }

        // ---- Email leg ----
        const emailOk = pref?.emailEnabled ?? true;
        if (
          !emailOk ||
          !isEmailAvailable() ||
          !member.user.email ||
          !notification
        ) {
          continue;
        }

        const sent = await sendEmail({
          to: member.user.email,
          subject: renderedEmail.subject,
          html: renderedEmail.html,
          text: renderedEmail.text,
        });
        if (sent.success) {
          emailed++;
          if (sent.messageId) {
            await prisma.notification
              .update({
                where: { id: notification.id },
                data: {
                  resendMessageId: sent.messageId,
                  emailDeliveryStatus: "sent",
                },
              })
              .catch((err) => {
                captureError(err, {
                  component: "cron.visit-reminder",
                  alertRoute: "p3-digest",
                  extra: {
                    action: "visit-reminder-cron:persist-message-id",
                    notificationId: notification.id,
                  },
                });
              });
          }
        } else {
          emailFailed++;
          captureMessage("[visit-reminder] sendEmail failed", {
            level: "warning",
            component: "cron.visit-reminder",
            alertRoute: "p2-email",
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
        component: "cron.visit-reminder",
        alertRoute: "p2-email",
        extra: {
          action: "visit-reminder-cron",
          phase,
          visitId: visit.id,
          venueId: visit.venue.id,
        },
      });
    }
  }

  const durationMs = Date.now() - start;
  logEvent({
    event: "visit_reminder_cron",
    fields: {
      phase,
      candidates: candidates.length,
      notified,
      emailed,
      emailFailed,
      pushed,
      pushPruned,
      pushTransient,
      errored,
      skipped,
      durationMs,
    },
  });

  return {
    ok: true,
    durationMs,
    candidates: candidates.length,
    notified,
    emailed,
    skipped,
    pushed,
    pushPruned,
    pushTransient,
    errored,
    emailFailed,
  };
}

/**
 * Phase-aware candidate query. Future-looking phases want
 * `(now, now+50h]`; way_home wants `[now-30h, now)`. Splitting here
 * keeps the SQL minimal — the (status, scheduledAt) composite index from
 * round 5/9 already supports both directions.
 */
async function loadCandidates(phase: VisitReminderPhase, now: Date) {
  if (phase === "way_home") {
    const windowStart = new Date(now.getTime() - PAST_CANDIDATE_WINDOW_MS);
    return prisma.visit.findMany({
      where: {
        status: { in: ["scheduled", "completed"] },
        deletedAt: null,
        scheduledAt: { gte: windowStart, lt: now },
      },
      select: candidateSelect,
    });
  }

  const windowEnd = new Date(now.getTime() + FUTURE_CANDIDATE_WINDOW_MS);
  return prisma.visit.findMany({
    where: {
      status: "scheduled",
      deletedAt: null,
      scheduledAt: { gt: now, lte: windowEnd },
    },
    select: candidateSelect,
  });
}

const candidateSelect = {
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
      ceremonyStyles: true,
    },
  },
} as const;

/**
 * Notification-click destination per phase. The push payload's `url`
 * field is what `public/sw.js` opens in `notificationclick`.
 *   day_before / morning_of → /visits/[id]/prep (preparation surface)
 *   way_home                 → /visits/[id]/way-home (memo flow)
 */
function pushTargetUrl(
  phase: VisitReminderPhase,
  visitId: string,
  venueId: string,
): string {
  if (phase === "way_home") return `/visits/${visitId}/way-home`;
  if (phase === "morning_of") return `/visits/${visitId}/prep`;
  // day_before still routes to the venue page (no /prep page exposed
  // by the prep ICS yet — keeps the link safe even on cold accounts).
  return `/venues/${venueId}`;
}
