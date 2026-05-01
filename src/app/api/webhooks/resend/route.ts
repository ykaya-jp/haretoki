import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/server/db";
import { captureError, captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";
import { isEmailAvailable, sendEmail } from "@/lib/email/send";
import {
  eventTypeToStatus,
  isSuppressingStatus,
  type EmailDeliveryStatus,
} from "@/lib/email/delivery";
import {
  adminNoticeBody,
  bouncePayloadToReason,
  isPermanentSuppression,
  type ResendBouncePayload,
  type SuppressionReason,
} from "@/lib/email/suppression";

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
 * Round 14 extension (P2.D commercial readiness): the suppression path
 * now also:
 *
 *   1. Categorises the bounce (hard / soft / complained) and stores
 *      the reason + timestamp on `NotificationPreference` so the daily
 *      retry cron can re-enable email for soft bounces after 7 days.
 *   2. Drops a user-facing in-app `Notification` row explaining why the
 *      email leg was disabled — the user sees "メールの配信を一時停止
 *      しました" in their inbox instead of silently losing email.
 *   3. Sends a one-shot admin-notice email to the `ADMIN_EMAILS` allow-
 *      list so the operator finds out about deliverability issues
 *      without having to log in to Resend.
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

  let event: {
    type?: string;
    data?: {
      email_id?: string;
      to?: string | string[];
      bounce?: ResendBouncePayload;
    };
  };
  try {
    event = resend.webhooks.verify({
      payload,
      headers,
      webhookSecret: secret,
    }) as typeof event;
  } catch (err) {
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
    await applyDeliveryEvent({
      messageId,
      status,
      bounce: event.data?.bounce,
    });
  } catch (err) {
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
 * suppressing statuses (`bounced` / `complained`), also:
 *   - record the suppression reason (categorised from
 *     `bounce.type`) on `NotificationPreference`
 *   - drop a user-facing in-app Notification row explaining the
 *     suppression
 *   - email the admin allow-list so the operator finds out
 */
async function applyDeliveryEvent(input: {
  messageId: string;
  status: EmailDeliveryStatus;
  bounce?: ResendBouncePayload;
}): Promise<void> {
  const { messageId, status, bounce } = input;

  const notification = await prisma.notification.findFirst({
    where: { resendMessageId: messageId },
    select: {
      id: true,
      userId: true,
      emailDeliveryStatus: true,
      user: { select: { email: true } },
    },
  });

  if (!notification) {
    // Either the email was sent before the resend_message_id column
    // existed (pre-migration row) or the messageId never made it onto
    // a Notification (e.g. partner invite, which is fire-and-forget).
    return;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { emailDeliveryStatus: status },
  });

  if (!isSuppressingStatus(status)) return;

  // Categorise the suppression. `email.complained` always maps to
  // 'complained' regardless of bounce payload; `email.bounced` looks
  // at bounce.type.
  const reason: SuppressionReason =
    status === "complained" ? "complained" : bouncePayloadToReason(bounce);
  const permanent = isPermanentSuppression(reason);

  // Upsert NotificationPreference with the new suppression metadata.
  // `emailEnabled = false` is set in BOTH branches; the cron decides
  // whether to flip it back later based on reason + timestamp.
  await prisma.notificationPreference.upsert({
    where: { userId: notification.userId },
    update: {
      emailEnabled: false,
      emailSuppressedReason: reason,
      emailSuppressedAt: new Date(),
    },
    create: {
      userId: notification.userId,
      emailEnabled: false,
      emailSuppressedReason: reason,
      emailSuppressedAt: new Date(),
    },
  });

  // User-facing in-app notification — explain WHY email stopped, in
  // soft user-friendly Japanese. Dedupe by Notification.type so a
  // user who bounces 5 emails in a day doesn't see 5 explanations.
  const userNoticeType = `email_suppression_notice:${reason}`;
  const existingUserNotice = await prisma.notification.count({
    where: { userId: notification.userId, type: userNoticeType },
  });
  if (existingUserNotice === 0) {
    await prisma.notification.create({
      data: {
        userId: notification.userId,
        type: userNoticeType,
        title: "メールの配信を一時停止しました",
        body: userNoticeBody(reason, permanent),
        href: "/mypage",
      },
    });
  }

  // Admin notice — fire-and-forget email to ADMIN_EMAILS so the
  // operator finds out about deliverability issues without having to
  // open Resend. Dedupe per-user-per-reason via a Notification row
  // keyed on the admin themselves; we don't have admin user rows so
  // we rely on a sentinel table-row-free check via the user's prefs
  // (the suppressedAt timestamp ticks each event; we only fire admin
  // notice when the prefs row was just transitioned from null reason
  // → reason, i.e. first event for this user/reason combination).
  // Implementation: read the prefs we just upserted and check whether
  // the OLD reason matches — but Prisma doesn't return prior values
  // from upsert. Cheaper: rely on the user-notice dedupe above as the
  // proxy for "first event" — the admin email follows the same
  // schedule.
  if (existingUserNotice === 0) {
    await emailAdminAllowlist({
      userEmail: notification.user.email,
      reason,
      permanent,
      details: bounce?.message ?? bounce?.subType ?? null,
    }).catch((err) => {
      captureError(err, {
        component: "webhook.resend",
        alertRoute: "p3-digest",
        extra: {
          action: "resend-webhook:admin-notice",
          userId: notification.userId,
          reason,
        },
      });
    });
  }
}

/**
 * User-facing copy for the in-app Notification row created when an
 * email leg gets suppressed. Soft Japanese, points the user at
 * /mypage where they can update their email or re-enable manually.
 */
function userNoticeBody(reason: SuppressionReason, permanent: boolean): string {
  if (reason === "complained") {
    return "迷惑メール報告のため、メール通知を停止しました。お困りの場合はマイページから設定をご確認ください。";
  }
  if (reason === "hard_bounce" || (reason === "soft_bounce" && permanent)) {
    return "メールアドレスへの配信に失敗したため、メール通知を停止しました。マイページからメールアドレスをご確認ください。";
  }
  return "メールが届かない状態を検知したため、メール通知を一時的に停止しました。7 日後に自動で再開します。マイページから今すぐ再開もできます。";
}

/**
 * Send a plain-text notice to every address in `ADMIN_EMAILS`. Skipped
 * silently when ADMIN_EMAILS is unset (local dev / preview), or when
 * Resend is not configured (`isEmailAvailable() === false`).
 */
async function emailAdminAllowlist(input: {
  userEmail: string;
  reason: SuppressionReason;
  permanent: boolean;
  details: string | null;
}): Promise<void> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  const recipients = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) return;
  if (!isEmailAvailable()) return;

  const { subject, text } = adminNoticeBody({
    userEmail: input.userEmail,
    reason: input.reason,
    permanent: input.permanent,
    details: input.details ?? undefined,
  });
  // Plain text envelope; admin tooling is not the brand surface, so
  // we skip the Editorial HTML wrapper.
  for (const to of recipients) {
    await sendEmail({
      to,
      subject,
      html: `<pre style="font-family:monospace;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</pre>`,
      text,
    });
  }
}
