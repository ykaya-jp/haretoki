import type { VisitReminderPhase } from "@/lib/visit-reminders";

interface VisitReminderInput {
  phase: VisitReminderPhase;
  venueName: string;
  /** Visit start as a UTC Date — formatter converts to JST display. */
  scheduledAt: Date;
  /** Optional access notes copied from Venue.accessInfo (truncated by caller). */
  accessInfo: string | null;
  /** Optional couple-side memo on the visit. Truncated by caller if long. */
  memo: string | null;
  /** Absolute URL into the venue detail page so the email is one tap away. */
  venueUrl: string;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Match partner-invite palette so the inbox stays visually consistent.
// Re-declared inline (no shared module) to keep the email layer self-
// contained and free of runtime React / CSS-var dependencies.
const BRAND = {
  bg: "#FAF6EE",
  card: "#FFFFFF",
  fg: "#3B3229",
  muted: "#7A6E62",
  goldWarm: "#C9A84C",
  goldSubtle: "#F3E9C7",
  primary: "#C27366",
} as const;

const PHASE_COPY: Record<
  VisitReminderPhase,
  { subject: (venue: string) => string; lead: string; cta: string }
> = {
  day_before: {
    subject: (venue) => `明日、${venue} の見学です（Haretoki）`,
    lead: "明日の見学、忘れていませんか。\n持ちものとチェックリストを、夜のうちに整えておきましょう。",
    cta: "見学準備を見る",
  },
  morning_of: {
    subject: (venue) => `今日、${venue} の見学です（Haretoki）`,
    lead: "今日が見学日です。\n会場までの行き方と、見ておきたいポイントを最後に確認しましょう。",
    cta: "チェックリストを開く",
  },
};

/**
 * Format a UTC Date as "M/D(曜) HH:MM" in JST. Email client display is
 * unpredictable so we render a string explicitly rather than relying on
 * locale-aware Intl in the recipient's timezone.
 */
function formatJstDateTime(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const m = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const dow = ["日", "月", "火", "水", "木", "金", "土"][shifted.getUTCDay()];
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${m}/${day}（${dow}）${hh}:${mm}`;
}

export function renderVisitReminderEmail(
  input: VisitReminderInput,
): RenderedEmail {
  const { phase, venueName, scheduledAt, accessInfo, memo, venueUrl } = input;
  const copy = PHASE_COPY[phase];
  const when = formatJstDateTime(scheduledAt);

  const subject = copy.subject(venueName);

  const accessBlock = accessInfo
    ? `<tr>
        <td style="font-size:13px;line-height:1.7;color:${BRAND.muted};padding-bottom:8px;">
          <strong style="color:${BRAND.fg};font-weight:500;">行き方</strong><br/>
          ${escapeHtml(accessInfo)}
        </td>
      </tr>`
    : "";

  const memoBlock = memo
    ? `<tr>
        <td style="font-size:13px;line-height:1.7;color:${BRAND.muted};padding-bottom:8px;">
          <strong style="color:${BRAND.fg};font-weight:500;">メモ</strong><br/>
          ${escapeHtml(memo)}
        </td>
      </tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ja">
  <body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;color:${BRAND.fg};">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${BRAND.card};border-radius:16px;padding:40px 32px;box-shadow:0 4px 16px rgba(59,50,41,0.08);">
            <tr>
              <td style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${BRAND.goldWarm};font-weight:500;padding-bottom:16px;">Haretoki — 見学リマインダー</td>
            </tr>
            <tr>
              <td style="font-family:'Noto Serif JP',serif;font-size:22px;font-weight:300;color:${BRAND.fg};padding-bottom:8px;letter-spacing:-0.01em;">${escapeHtml(venueName)}</td>
            </tr>
            <tr>
              <td style="font-size:14px;line-height:1.6;color:${BRAND.muted};padding-bottom:24px;">${escapeHtml(when)}</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.8;color:${BRAND.fg};padding-bottom:24px;white-space:pre-line;">${escapeHtml(copy.lead)}</td>
            </tr>
            ${accessBlock}
            ${memoBlock}
            <tr>
              <td align="center" style="padding:16px 0 24px;">
                <a href="${encodeURI(venueUrl)}" style="display:inline-block;background-color:${BRAND.primary};color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:999px;font-size:15px;font-weight:400;min-height:44px;line-height:1.2;">${escapeHtml(copy.cta)}</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:0.5px solid ${BRAND.goldSubtle};padding-top:16px;font-size:11px;line-height:1.6;color:${BRAND.muted};">
                通知の頻度は<a href="${encodeURI(venueUrl.replace(/\/venues\/.*$/, "/mypage"))}" style="color:${BRAND.goldWarm};text-decoration:underline;">マイページ</a>から変更できます。<br/>
                Haretoki — 式場選びを、もっと納得のいくものに。
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const lines = [
    subject,
    "",
    `${venueName}`,
    `${when}`,
    "",
    copy.lead,
  ];
  if (accessInfo) {
    lines.push("", "行き方:", accessInfo);
  }
  if (memo) {
    lines.push("", "メモ:", memo);
  }
  lines.push("", `${copy.cta}: ${venueUrl}`, "", "Haretoki");

  return { subject, html, text: lines.join("\n") };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
