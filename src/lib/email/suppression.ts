/**
 * Email suppression policy — single source of truth for "why we
 * stopped sending email" + "when (if ever) we should retry".
 *
 * Resend webhook events ([`docs/ai/cost-baseline.md`](../../docs/ai/cost-baseline.md))
 * carry a `bounce.type` field for `email.bounced` events: hard /
 * soft / undetermined. We map those (plus the simpler complained /
 * manual cases) to a 4-value reason string stored on
 * `NotificationPreference.emailSuppressedReason`. The retry cron
 * `/api/cron/email-suppression-retry` reads the reason + timestamp
 * to decide whether 7 days have elapsed for a soft bounce.
 *
 * The reason taxonomy is intentionally COARSE (4 buckets) — the goal
 * is operationally legible, not "every Resend tag faithfully
 * preserved". A new Resend bounce sub-type just maps to one of the
 * existing buckets.
 */

export type SuppressionReason =
  | "hard_bounce"
  | "soft_bounce"
  | "complained"
  | "manual";

/** Suppressions that never auto-retry. User must update email manually. */
const PERMANENT_REASONS = new Set<SuppressionReason>([
  "hard_bounce",
  "complained",
  "manual",
]);

/** Suppressions eligible for the daily retry cron. */
const RETRYABLE_REASONS = new Set<SuppressionReason>(["soft_bounce"]);

/** Cooldown after a soft bounce before the cron re-enables email. */
export const SOFT_BOUNCE_RETRY_DAYS = 7;

export function isPermanentSuppression(reason: SuppressionReason): boolean {
  return PERMANENT_REASONS.has(reason);
}

export function isRetryableSuppression(
  reason: SuppressionReason | null | undefined,
): boolean {
  if (!reason) return false;
  return RETRYABLE_REASONS.has(reason as SuppressionReason);
}

/**
 * Resend bounce event payload shape (verified against the Resend
 * documentation 2026-05). We only read the small subset we care about
 * — `type`, `subType`, `message` — so a future schema additions don't
 * break the parser.
 */
export interface ResendBouncePayload {
  type?: string;
  subType?: string;
  message?: string;
}

/**
 * Translate a Resend `email.bounced` payload's `bounce` block into
 * our reason taxonomy. The mapping is deliberately conservative —
 * "undetermined" or unknown subType lands as `soft_bounce` so we
 * cooldown 7 days rather than permanently suppress on a glitch.
 *
 * Resend bounce.type values per docs:
 *   - `Permanent` — invalid address, mailbox does not exist → hard
 *   - `Transient` — mailbox full, server temporarily unavailable → soft
 *   - `Undetermined` — could not classify → soft (conservative)
 */
export function bouncePayloadToReason(
  bounce: ResendBouncePayload | null | undefined,
): SuppressionReason {
  const type = (bounce?.type ?? "").toLowerCase();
  if (type === "permanent") return "hard_bounce";
  // Transient and Undetermined both → soft_bounce. The retry cron
  // gives them a fair shake after 7 days; permanent classification
  // requires an explicit "Permanent" signal from the ESP.
  return "soft_bounce";
}

/**
 * Mailto subject + body the Resend webhook handler uses to email the
 * admin allow-list when a suppression fires for the first time per
 * (userId, reason) pair. Plain text — admin tooling email, not a
 * Editorial-branded surface.
 */
export function adminNoticeBody(input: {
  userEmail: string;
  reason: SuppressionReason;
  permanent: boolean;
  details?: string;
}): { subject: string; text: string } {
  const subject = `[Haretoki ops] ${input.reason} suppression: ${input.userEmail}`;
  const text = [
    `Email suppression recorded.`,
    ``,
    `User:       ${input.userEmail}`,
    `Reason:     ${input.reason}`,
    `Permanent:  ${input.permanent ? "yes (no auto-retry)" : "no (7-day cooldown)"}`,
    input.details ? `Details:    ${input.details}` : "",
    ``,
    `Investigate at: /admin/cost`,
    `Doc:            docs/ai/cost-baseline.md`,
    ``,
    `— Haretoki webhook handler`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, text };
}
