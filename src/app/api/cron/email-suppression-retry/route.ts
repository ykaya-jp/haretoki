import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { captureError } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import { SOFT_BOUNCE_RETRY_DAYS } from "@/lib/email/suppression";

/**
 * GET|POST /api/cron/email-suppression-retry
 *
 * Daily cron — re-enables email for users whose Resend bounce was
 * categorised as `soft_bounce` more than `SOFT_BOUNCE_RETRY_DAYS`
 * (default 7) ago. Hard bounces and complaints are NEVER retried —
 * the user must manually re-enable from /mypage settings.
 *
 * Auth: Bearer CRON_SECRET (matches the four sibling crons).
 *
 * Idempotent: re-running same day re-evaluates the same query — rows
 * already re-enabled drop out of the WHERE clause because their
 * `emailSuppressedReason` is set to NULL on retry.
 *
 * Lands a `email_suppression_retry` structured log line so the
 * operator can grep retry counts in `vercel logs`.
 */

export const maxDuration = 60;

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
  const cutoff = new Date(
    Date.now() - SOFT_BOUNCE_RETRY_DAYS * 24 * 60 * 60 * 1000,
  );

  let retried = 0;
  let scanned = 0;

  try {
    // Predicate hits the (emailSuppressedReason, emailSuppressedAt)
    // composite index added by the round-14 migration. Single
    // updateMany per cron tick — the daily volume is bounded by
    // however many soft bounces accumulated in 7 days, so the row
    // count stays small even under heavy traffic.
    const result = await prisma.notificationPreference.updateMany({
      where: {
        emailSuppressedReason: "soft_bounce",
        emailSuppressedAt: { lt: cutoff },
      },
      data: {
        emailEnabled: true,
        emailSuppressedReason: null,
        emailSuppressedAt: null,
      },
    });
    retried = result.count;
    // No cheap way to get a "would have matched but didn't" count from
    // updateMany; logged as the same value so operators can compare
    // against the soft-bounce volume in the suppression event log
    // (`logEvent(event:resend_webhook, status:bounced)`).
    scanned = retried;
  } catch (err) {
    captureError(err, {
      component: "cron.email-suppression-retry",
      alertRoute: "p2-email",
      extra: { action: "email-suppression-retry:updateMany" },
    });
  }

  logEvent({
    event: "email_suppression_retry",
    fields: {
      retried,
      scanned,
      cutoffIsoDate: cutoff.toISOString(),
      durationMs: Date.now() - start,
    },
  });

  return NextResponse.json({
    ok: true,
    retried,
    scanned,
    cutoffIsoDate: cutoff.toISOString(),
    durationMs: Date.now() - start,
  });
}
