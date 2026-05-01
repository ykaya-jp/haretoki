import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { sendEmail, isEmailAvailable } from "@/lib/email/send";
import { renderVisitReminderEmail } from "@/lib/email/templates/visit-reminder";
import {
  classifyVisitReminderPhase,
  visitReminderType,
  type VisitReminderPhase,
} from "@/lib/visit-reminders";

/**
 * GET/POST /api/cron/visit-reminders
 *
 * Phase 2.C — visit reminder notification system. Hourly cron that fans out
 * three reminder phases (前日 / 当日朝 / 出発前) to every accepted couple
 * member of the visit's project.
 *
 * Auth: Bearer CRON_SECRET (same shape as the three sibling crons).
 *
 * Idempotency: per-user dedupe via `Notification.type =
 * visit_reminder_${phase}:${visitId}`. Multiple cron ticks land on the same
 * visit during a phase's eligible window (e.g. day_before fires every
 * 18-20 JST hour); the dedupe predicate collapses repeat sends to one.
 *
 * Visit scope: only `status: "scheduled"`, `deletedAt: null`, scheduled in
 * the next 50 hours. The 50h ceiling cleanly covers the day_before window
 * while keeping the candidate set small even for projects with a backlog.
 *
 * Recipient policy: reminder reaches every accepted ProjectMember that owns
 * the visit. Same authorization shape as `decision-followup` — the visit
 * is project-shared, so both members are stakeholders.
 *
 * Notification preferences:
 * - `frequency: "off"`  → no Notification, no email.
 * - `emailEnabled: false` → still creates an in-app Notification, skips
 *   the Resend call. Members who turned email off can still see the
 *   reminder in the app inbox without it cluttering their email.
 * - default (no preference row) → both Notification and email are sent.
 */
export const maxDuration = 300;

const CANDIDATE_WINDOW_MS = 50 * 60 * 60 * 1000;

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
  let phaseHits: Record<VisitReminderPhase, number> = {
    day_before: 0,
    morning_of: 0,
    before_departure: 0,
  };

  // Site origin for the venue link in the email body. Falls back to a
  // bare path so the email still renders if the env var is unset (link
  // becomes relative; most email clients tolerate this).
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "";

  for (const visit of candidates) {
    if (!visit.scheduledAt) {
      skipped++;
      continue;
    }
    const phase = classifyVisitReminderPhase({
      scheduledAt: visit.scheduledAt,
      now,
    });
    if (!phase) {
      skipped++;
      continue;
    }

    // Resolve recipients = accepted members + their email + notification pref.
    // Single round-trip per visit; the project member set is small (typically 2)
    // so per-visit join overhead is negligible.
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
      // "off" silences both in-app and email — same semantics as
      // getAIInsights' frequency gate.
      if (pref?.frequency === "off") {
        skipped++;
        continue;
      }

      // Per-user, per-(visit, phase) dedupe. The composite type marker
      // gives us exact-match lookup with no fuzzy parsing.
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
      phaseHits = { ...phaseHits, [phase]: phaseHits[phase] + 1 };

      // Email opt-out: still notify in-app, but don't pile up email if the
      // user explicitly disabled it. Default (no preference row) is opt-in.
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
      if (sent.success) emailed++;
    }
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    candidates: candidates.length,
    notified,
    emailed,
    skipped,
    phaseHits,
  });
}
