/**
 * Append-only audit log helper.
 *
 * Records sensitive operations (account delete, data export, admin
 * dashboard view, cron failures that affected user data, future
 * payment events) to the `audit_logs` table. Read-side: SQL or a
 * future `/admin/audit` page; write-side: only via `recordAudit()`
 * below — no Prisma direct-create call sites should exist outside
 * this module.
 *
 * Best-effort writes: a failure to record an audit row never blocks
 * the calling operation. The fallback is a Sentry capture so the
 * incident is still visible during postmortem.
 *
 * PII handling:
 *   - Email addresses get hashed (sha256 → first 16 hex chars) before
 *     they land in `detail`.
 *   - IP addresses get coarsened (`/24` for IPv4, `/48` for IPv6).
 *   - User-Agent strings get truncated to 256 chars.
 *
 * Pure helpers (`hashEmail`, `redactIp`, `truncateUa`,
 * `extractRequestMeta`) live in `src/lib/audit-helpers.ts` so test
 * specs can import them without standing up Prisma.
 */

import { prisma } from "@/server/db";
import { captureError } from "@/lib/sentry";
import {
  hashEmail,
  redactIp,
  truncateUa,
  extractRequestMeta,
} from "@/lib/audit-helpers";

export { hashEmail, redactIp, truncateUa, extractRequestMeta };

/**
 * Canonical action verbs. Adding a new value here is preferred over
 * passing a free-form string — the fixed list keeps the
 * (action, created_at) index selective and makes ad-hoc dashboards
 * possible without ELT preprocessing.
 *
 * Domain prefix conventions:
 *   - `user.*`     — user-initiated actions on their own account
 *   - `admin.*`    — actions taken by the admin allow-list
 *   - `cron.*`     — scheduled-job outcomes worth durable record
 *   - `webhook.*`  — third-party webhook receipts (Resend, future
 *                     Stripe, etc.)
 *   - `system.*`   — startup / config / operational signals
 */
export type AuditAction =
  | "user.export"
  | "user.delete.requested"
  | "user.delete.completed"
  | "user.delete.failed"
  | "admin.cost.viewed"
  | "admin.audit.viewed"
  | "cron.email-suppression-retry.failed"
  | "cron.ai-cost-summary.snapshot-failed"
  | "webhook.resend.suppression-applied"
  | "system.secret-rotated";

export type AuditActorRole = "user" | "admin" | "system" | "cron" | "webhook";

export interface RecordAuditInput {
  action: AuditAction;
  actorId: string;
  actorRole?: AuditActorRole;
  target?: { type: string; id: string };
  request?: { ip?: string | null; userAgent?: string | null };
  detail?: Record<string, unknown>;
}

/**
 * Append a row to `audit_logs`. Best-effort — failures are reported
 * to Sentry but never thrown back to the caller.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId,
        actorRole: input.actorRole ?? null,
        targetType: input.target?.type ?? null,
        targetId: input.target?.id ?? null,
        ipAddress: redactIp(input.request?.ip),
        userAgent: truncateUa(input.request?.userAgent),
        detail: (input.detail ?? null) as never,
      },
    });
  } catch (err) {
    captureError(err, {
      component: "db",
      alertRoute: "p2-email",
      extra: { action: "audit.record-failed", auditAction: input.action },
    });
  }
}
