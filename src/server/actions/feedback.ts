"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { requireUser } from "@/server/auth";
import { recordAudit } from "@/server/audit";
import { sendEmail, isEmailAvailable } from "@/lib/email/send";
import { checkSupportRateLimit } from "@/lib/support/rate-limit";

/**
 * Beta feedback submission (separate channel from /support).
 *
 * Why a separate channel from /support:
 *   - /support is for "I have a problem, please fix" — recovery-shaped
 *   - /feedback is for "thoughts on the experience" — research-shaped
 *
 * The two share the same email + rate-limit infrastructure (Beta scale
 * doesn't justify a second pipeline) but they record distinct audit
 * verbs (`user.feedback.submitted` vs `support.message.sent`) so the
 * /admin/feedback view can show the latter without scrolling past
 * incident reports.
 *
 * Audit row stores ONLY meta — subject, body length, has-contact flag.
 * The raw body lives in the email + the operator log; we deliberately
 * don't write user-typed prose into audit_logs (PII surface, not
 * recovery-load-bearing — the email is the source of truth).
 */

const FEEDBACK_INBOX_FALLBACK = "feedback@haretoki.app";

const feedbackSchema = z.object({
  subject: z
    .string()
    .min(2, "件名は 2 文字以上で入力してください")
    .max(80, "件名は 80 文字以内で入力してください")
    .transform((v) => v.trim()),
  body: z
    .string()
    .min(10, "本文は 10 文字以上で入力してください")
    .max(4000, "本文は 4000 文字以内で入力してください")
    .transform((v) => v.trim()),
  /**
   * Optional reply-to. Empty string means "use the authenticated user's
   * registered email" — same fallback shape as /support so the form
   * pattern is symmetric.
   */
  contact: z
    .string()
    .max(254)
    .optional()
    .transform((v) => v?.trim() ?? "")
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "メールアドレスの形式が正しくありません",
    }),
});

export type FeedbackFormResult =
  | { success: true }
  | { success: false; error: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFeedbackEmail(opts: {
  subject: string;
  body: string;
  user: { id: string; email: string };
  contact: string;
  ua: string;
}): { html: string; text: string } {
  const safeSubject = escapeHtml(opts.subject);
  const safeBody = escapeHtml(opts.body).replace(/\n/g, "<br/>");
  const safeContact = escapeHtml(opts.contact || opts.user.email);
  const safeUa = escapeHtml(opts.ua).slice(0, 200);

  const html = `<!doctype html>
<html lang="ja"><body style="font-family:system-ui,-apple-system,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;line-height:1.7;color:#1f1a17;">
<h2 style="margin:0 0 8px 0;font-weight:400;">[Haretoki Beta] ${safeSubject}</h2>
<p style="margin:0 0 16px 0;font-size:13px;color:#7a6e64;">差出人: ${safeContact} (Haretoki user ${opts.user.id})</p>
<hr style="border:0;border-top:1px solid #e6dfd6;margin:16px 0;"/>
<p style="white-space:pre-wrap;">${safeBody}</p>
<hr style="border:0;border-top:1px solid #e6dfd6;margin:24px 0 12px 0;"/>
<p style="font-size:11px;color:#a89c91;">User-Agent: ${safeUa}</p>
</body></html>`;

  const text = `[Haretoki Beta] ${opts.subject}
差出人: ${opts.contact || opts.user.email} (Haretoki user ${opts.user.id})

${opts.body}

---
User-Agent: ${opts.ua.slice(0, 200)}
`;

  return { html, text };
}

/**
 * Submit a Beta-period feedback message. Mirrors /support semantics:
 * even when Resend is misconfigured, we record a server-side log so
 * the operator can recover; we never echo "infra unavailable" to the
 * couple because they can't fix it on their side.
 */
export async function submitFeedback(input: {
  subject: string;
  body: string;
  contact?: string;
}): Promise<FeedbackFormResult> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstField =
      fieldErrors.subject?.[0] ??
      fieldErrors.body?.[0] ??
      fieldErrors.contact?.[0] ??
      "入力内容を確認してください";
    return { success: false, error: firstField };
  }

  const user = await requireUser();

  // Rate limit shared with /support — Beta scale doesn't justify a
  // separate bucket, and a couple genuinely shouldn't be filing 5
  // feedback messages in an hour anyway. If they ARE, that's a UX
  // signal worth its own discussion.
  const rate = checkSupportRateLimit(user.id);
  if (!rate.ok) {
    return {
      success: false,
      error:
        "短時間に多くの送信がありました。少し時間をおいてからもう一度お試しください。",
    };
  }

  const h = await headers();
  const ua = h.get("user-agent") ?? "unknown";

  // Server log — recoverability path when Resend is down. PII (user
  // id + body length only — NOT the body itself) stays well-bounded.
  console.info("feedback.submit", {
    userId: user.id,
    userEmail: user.email,
    subject: parsed.data.subject,
    bodyLength: parsed.data.body.length,
    hasContact: parsed.data.contact !== "",
    timestamp: new Date().toISOString(),
  });

  // Audit row — meta only, no body content. The /admin/feedback view
  // reads this to render the inbox without joining the email leg.
  await recordAudit({
    action: "user.feedback.submitted",
    actorId: user.id,
    actorRole: "user",
    detail: {
      subject: parsed.data.subject,
      bodyLength: parsed.data.body.length,
      hasContact: parsed.data.contact !== "",
    },
  });

  const inbox = process.env.FEEDBACK_EMAIL ?? FEEDBACK_INBOX_FALLBACK;

  if (!isEmailAvailable()) {
    // Recoverability contract — operator notices via the server log.
    return { success: true };
  }

  const rendered = renderFeedbackEmail({
    subject: parsed.data.subject,
    body: parsed.data.body,
    user: { id: user.id, email: user.email ?? "" },
    contact: parsed.data.contact,
    ua,
  });

  const result = await sendEmail({
    to: inbox,
    subject: `[Haretoki Beta] ${parsed.data.subject}`,
    html: rendered.html,
    text: rendered.text,
  });

  if (!result.success) {
    console.error("feedback.send_failed", {
      userId: user.id,
      error: result.error,
    });
    // Same as /support: hide infra errors from the couple, the
    // operator already has the body in the server log + the audit
    // meta.
    return { success: true };
  }

  return { success: true };
}
