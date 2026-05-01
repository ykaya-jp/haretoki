import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/server/db";
import { captureError, captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import {
  eventTypeToStatus,
  isSuppressingStatus,
  type EmailDeliveryStatus,
} from "@/lib/email/delivery";

/**
 * POST /api/webhooks/resend
 *
 * Resend webhook receiver. Verifies the Svix-style signature using the
 * Resend SDK (`resend.webhooks.verify`), maps the event type to our
 * `EmailDeliveryStatus`, updates the originating Notification row, and
 * — for `bounced` / `complained` — flips
 * `NotificationPreference.emailEnabled` off for the owning user so the
 * next cron tick doesn't dispatch another email to the same harmed
 * address.
 *
 * Auth: Svix HMAC headers (`svix-id` / `svix-timestamp` /
 * `svix-signature`) verified against `RESEND_WEBHOOK_SECRET` (whsec_...
 * format issued by Resend at webhook creation). Missing secret returns
 * 503; bad signature returns 400 — both per Resend's recommended
 * pattern. Once verified the work is best-effort: we always 200 to
 * avoid Resend's exponential-retry queue piling up on transient DB
 * blips. Errors get reported to Sentry with the message id as scope.
 *
 * Runtime: default Node.js (Cache Components forbids explicit
 * `export const runtime = "nodejs"`; the framework default already
 * lands on Node, so the SDK + Prisma both work as expected).
 */

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "RESEND_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  // Read the raw body BEFORE JSON-parsing — Svix signature is over the
  // raw bytes. NextRequest.json() consumes the body, so we use .text().
  const payload = await request.text();
  const headers = {
    id: request.headers.get("svix-id") ?? "",
    timestamp: request.headers.get("svix-timestamp") ?? "",
    signature: request.headers.get("svix-signature") ?? "",
  };

  // Resend SDK requires an API key for the constructor even when only
  // the verify path is used. Pass the same key the email-send module
  // uses; if it's unset we still construct the client (the SDK
  // tolerates an empty key for verify-only flows).
  const resend = new Resend(process.env.RESEND_API_KEY ?? "unused-for-verify");

  let event: { type?: string; data?: { email_id?: string; to?: string | string[] } };
  try {
    event = resend.webhooks.verify({
      payload,
      headers,
      webhookSecret: secret,
    }) as typeof event;
  } catch (err) {
    // 400 tells Resend the signature was invalid — they won't retry on
    // 400, which is what we want for genuinely bad senders. Spurious
    // 400s are a sign that the secret is rotated; investigate via
    // Sentry rather than dropping the lead. Tagged p1-page because a
    // sustained signature mismatch usually means the webhook is
    // mis-configured AND a third party is hitting our endpoint.
    captureError(err, {
      component: "webhook.resend",
      alertRoute: "p1-page",
      extra: { action: "resend-webhook:verify" },
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventType = event.type ?? "";
  const status = eventTypeToStatus(eventType);
  const messageId = event.data?.email_id;

  if (!status || !messageId) {
    // Unknown event type or missing id — log a structured warning so we
    // can grep for new event types Resend introduces, and 200 to ack.
    captureMessage("[resend-webhook] event ignored", {
      level: "info",
      component: "webhook.resend",
      alertRoute: "p3-digest",
      extra: { eventType, hasMessageId: Boolean(messageId) },
    });
    logEvent({
      event: "resend_webhook",
      fields: { eventType, status: null, applied: false },
    });
    return NextResponse.json({ received: true, applied: false });
  }

  try {
    await applyDeliveryEvent({ messageId, status });
  } catch (err) {
    // DB blip — ack with 200 so Resend doesn't retry-storm us, but
    // surface the issue so we can backfill manually if needed.
    captureError(err, {
      component: "webhook.resend",
      alertRoute: "p2-email",
      extra: {
        action: "resend-webhook:apply",
        messageId,
        status,
      },
    });
  }

  logEvent({
    event: "resend_webhook",
    fields: {
      eventType,
      status,
      messageIdPrefix: messageId.slice(0, 12),
      applied: true,
    },
  });

  return NextResponse.json({ received: true, applied: true });
}

/**
 * Apply a delivery event to the matching Notification row. For
 * suppressing statuses (`bounced` / `complained`), also flip the
 * owner's `NotificationPreference.emailEnabled` to false so future
 * cron ticks skip the email leg. The in-app Notification stream is
 * unchanged — disabling email shouldn't silence the inbox surface.
 */
async function applyDeliveryEvent(input: {
  messageId: string;
  status: EmailDeliveryStatus;
}): Promise<void> {
  const { messageId, status } = input;

  const notification = await prisma.notification.findFirst({
    where: { resendMessageId: messageId },
    select: { id: true, userId: true, emailDeliveryStatus: true },
  });

  if (!notification) {
    // Either the email was sent before the resend_message_id column
    // existed (pre-migration row) or the messageId never made it onto
    // a Notification (e.g. partner invite, which is fire-and-forget).
    // Fine to drop — the suppression below still fires for known users.
    return;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { emailDeliveryStatus: status },
  });

  if (isSuppressingStatus(status)) {
    // Upsert NotificationPreference so we can flip emailEnabled even
    // for users who never visited the prefs UI (default row absent).
    await prisma.notificationPreference.upsert({
      where: { userId: notification.userId },
      update: { emailEnabled: false },
      create: { userId: notification.userId, emailEnabled: false },
    });
  }
}
