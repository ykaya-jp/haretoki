/**
 * Resend email delivery status constants.
 *
 * Mirrors the event types Resend's webhook can send (per
 * https://resend.com/docs/dashboard/webhooks/event-types — verified
 * via Context7 2026-05-02). Stored as plain strings on
 * `Notification.emailDeliveryStatus` so a new event type from Resend
 * doesn't require a Prisma migration; app-level callers use the
 * helpers below to stay type-safe.
 *
 * Suppression rules (which statuses should auto-disable email for the
 * owning user) are encoded in `SUPPRESSING_STATUSES` so the Resend
 * webhook handler and any future bulk-import path stay consistent.
 */

export const EMAIL_DELIVERY_STATUSES = [
  "sent",
  "delivered",
  "delivery_delayed",
  "bounced",
  "complained",
  "opened",
  "clicked",
] as const;

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

/**
 * Statuses that mean "the email address is harming our sender
 * reputation, stop sending to this user". Bounce = address invalid /
 * mailbox full / hard bounce; complaint = recipient marked as spam.
 * Both warrant flipping `NotificationPreference.emailEnabled` off so
 * the next cron tick doesn't dispatch another email and worsen the
 * deliverability score with the ESP.
 *
 * `delivery_delayed` is NOT here — transient delivery delay (queue
 * congestion at the recipient MX) is normal and resolves on its own.
 */
export const SUPPRESSING_STATUSES = new Set<EmailDeliveryStatus>([
  "bounced",
  "complained",
]);

/** Map Resend event type ("email.bounced") to our status enum ("bounced"). */
export function eventTypeToStatus(
  eventType: string,
): EmailDeliveryStatus | null {
  if (!eventType.startsWith("email.")) return null;
  const tail = eventType.slice("email.".length);
  return (EMAIL_DELIVERY_STATUSES as readonly string[]).includes(tail)
    ? (tail as EmailDeliveryStatus)
    : null;
}

export function isSuppressingStatus(status: EmailDeliveryStatus): boolean {
  return SUPPRESSING_STATUSES.has(status);
}
