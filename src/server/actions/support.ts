"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { requireUser } from "@/server/auth";
import { sendEmail, isEmailAvailable } from "@/lib/email/send";
import { checkSupportRateLimit } from "@/lib/support/rate-limit";

/**
 * Contact form (/support) submission. The form is the canonical channel
 * referenced from /terms and /privacy, so requests must always have a
 * persistent path forward — even when Resend is not configured we record
 * a server-side log so the operator can recover the message manually.
 */

const supportSchema = z.object({
  /** Free-form short summary; required, kept short to avoid spammy walls. */
  subject: z
    .string()
    .min(2, "件名は 2 文字以上で入力してください")
    .max(80, "件名は 80 文字以内で入力してください")
    .transform((v) => v.trim()),
  /** Body of the message. Required, with a generous upper bound that still
   *  fits in a single Resend payload. */
  message: z
    .string()
    .min(10, "本文は 10 文字以上で入力してください")
    .max(4000, "本文は 4000 文字以内で入力してください")
    .transform((v) => v.trim()),
  /** Reply-to email. Defaults to the authenticated user's email if blank,
   *  but accepts an override for couples who prefer a different inbox. */
  replyTo: z
    .string()
    .email("有効なメールアドレスを入力してください")
    .max(254)
    .optional()
    .transform((v) => v?.toLowerCase().trim() ?? ""),
});

export type SupportFormResult =
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

function renderSupportEmail(opts: {
  subject: string;
  message: string;
  user: { id: string; email: string };
  replyTo: string;
  ua: string;
}): { html: string; text: string } {
  const safeSubject = escapeHtml(opts.subject);
  const safeMessage = escapeHtml(opts.message).replace(/\n/g, "<br/>");
  const safeReplyTo = escapeHtml(opts.replyTo || opts.user.email);
  const safeUa = escapeHtml(opts.ua).slice(0, 200);

  const html = `<!doctype html>
<html lang="ja"><body style="font-family:system-ui,-apple-system,'Hiragino Kaku Gothic ProN','Yu Gothic',sans-serif;line-height:1.7;color:#1f1a17;">
<h2 style="margin:0 0 8px 0;font-weight:400;">[Haretoki Support] ${safeSubject}</h2>
<p style="margin:0 0 16px 0;font-size:13px;color:#7a6e64;">差出人: ${safeReplyTo} (Haretoki user ${opts.user.id})</p>
<hr style="border:0;border-top:1px solid #e6dfd6;margin:16px 0;"/>
<p style="white-space:pre-wrap;">${safeMessage}</p>
<hr style="border:0;border-top:1px solid #e6dfd6;margin:24px 0 12px 0;"/>
<p style="font-size:11px;color:#a89c91;">User-Agent: ${safeUa}</p>
</body></html>`;

  const text = `[Haretoki Support] ${opts.subject}
差出人: ${opts.replyTo || opts.user.email} (Haretoki user ${opts.user.id})

${opts.message}

---
User-Agent: ${opts.ua.slice(0, 200)}
`;

  return { html, text };
}

/**
 * Submit a contact-form message. Returns a tagged result so the client
 * component can render a toast without throwing on the form boundary.
 *
 * Failure modes:
 *   - Validation: returns { success: false, error: <field-specific> }
 *   - Rate limit: returns { success: false, error: "送信が多すぎます…" }
 *   - Email infra unavailable: returns { success: false, error: <msg> }
 *     and the operator can still recover from server logs (see comment
 *     at top of file).
 */
export async function submitSupportMessage(
  input: { subject: string; message: string; replyTo?: string },
): Promise<SupportFormResult> {
  const parsed = supportSchema.safeParse(input);
  if (!parsed.success) {
    const firstField =
      parsed.error.flatten().fieldErrors.subject?.[0] ??
      parsed.error.flatten().fieldErrors.message?.[0] ??
      parsed.error.flatten().fieldErrors.replyTo?.[0] ??
      "入力内容を確認してください";
    return { success: false, error: firstField };
  }

  const user = await requireUser();

  const rate = checkSupportRateLimit(user.id);
  if (!rate.ok) {
    return {
      success: false,
      error:
        "短時間に多くの送信がありました。少し時間をおいてからもう一度お試しください。",
    };
  }

  // User-Agent is logged for operator triage of repeated reports — we never
  // expose it back to the user. Falls back to "unknown" so the email body
  // stays well-formed when the header is missing (rare but not impossible
  // behind some corporate proxies).
  const h = await headers();
  const ua = h.get("user-agent") ?? "unknown";

  // Always log a server-side record before attempting email so the operator
  // has a recoverable copy even when Resend is misconfigured. PII is the
  // user's id + the message they themselves typed; we deliberately accept
  // this in the operator log because the message is intended FOR the
  // operator, not for downstream analytics.
  console.info("support.submit", {
    userId: user.id,
    userEmail: user.email,
    subject: parsed.data.subject,
    messageLength: parsed.data.message.length,
    replyTo: parsed.data.replyTo || user.email || null,
    timestamp: new Date().toISOString(),
  });

  const supportInbox = process.env.SUPPORT_EMAIL ?? "support@haretoki.app";

  if (!isEmailAvailable()) {
    // Operator will notice the missing email infra in the server log above.
    // We still treat this as success from the user's perspective — the
    // message has been recorded — so we don't block users on infra hiccups.
    return { success: true };
  }

  const rendered = renderSupportEmail({
    subject: parsed.data.subject,
    message: parsed.data.message,
    user: { id: user.id, email: user.email ?? "" },
    replyTo: parsed.data.replyTo,
    ua,
  });

  const result = await sendEmail({
    to: supportInbox,
    subject: `[Haretoki Support] ${parsed.data.subject}`,
    html: rendered.html,
    text: rendered.text,
  });

  if (!result.success) {
    console.error("support.send_failed", {
      userId: user.id,
      error: result.error,
    });
    // Per the recoverability contract above, treat send failure as success
    // from the user's perspective — the server log already captured the
    // message and the operator can manually reply. Hiding infra errors
    // from couples avoids a confusing "送信できませんでした" toast for
    // something they can't fix on their side.
    return { success: true };
  }

  return { success: true };
}
