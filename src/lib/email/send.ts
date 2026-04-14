import { Resend } from "resend";

// Resend is initialized only when RESEND_API_KEY is set.
// Unset → sendEmail gracefully returns { success: false, error: "EMAIL_NOT_CONFIGURED" }
// so callers can fall back to URL-only invitations without throwing.
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export function isEmailAvailable(): boolean {
  return resend !== null;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<
  | { success: true; messageId: string | undefined }
  | { success: false; error: string }
> {
  if (!resend) {
    return { success: false, error: "EMAIL_NOT_CONFIGURED" };
  }
  const from = process.env.EMAIL_FROM ?? "Haretoki <noreply@haretoki.app>";
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "send failed",
    };
  }
}
