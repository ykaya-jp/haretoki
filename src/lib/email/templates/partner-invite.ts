interface PartnerInviteInput {
  inviterName: string;
  projectName: string;
  inviteUrl: string;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Morning Light palette approximated as sRGB hex for email client compatibility
// (no CSS vars, no external stylesheet — inline only).
const BRAND = {
  bg: "#FAF6EE",
  card: "#FFFFFF",
  fg: "#3B3229",
  muted: "#7A6E62",
  goldWarm: "#C9A84C",
  goldSubtle: "#F3E9C7",
  primary: "#C27366",
} as const;

export function renderPartnerInviteEmail(
  input: PartnerInviteInput,
): RenderedEmail {
  const { inviterName, projectName, inviteUrl } = input;

  const subject = `${inviterName}さんから招待が届いています（Haretoki）`;

  const html = `<!DOCTYPE html>
<html lang="ja">
  <body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;color:${BRAND.fg};">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${BRAND.card};border-radius:16px;padding:40px 32px;box-shadow:0 4px 16px rgba(59,50,41,0.08);">
            <tr>
              <td style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:${BRAND.goldWarm};font-weight:500;padding-bottom:16px;">Haretoki</td>
            </tr>
            <tr>
              <td style="font-family:'Noto Serif JP',serif;font-size:24px;font-weight:300;color:${BRAND.fg};padding-bottom:16px;letter-spacing:-0.01em;">式場選びを、一緒に。</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.8;color:${BRAND.fg};padding-bottom:24px;">
                ${escapeHtml(inviterName)}さんが「${escapeHtml(projectName)}」におふたりを招ばれました。<br/>
                下のボタンから、ふたりの式場さがしに合流してください。
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:8px 0 24px;">
                <a href="${encodeURI(inviteUrl)}" style="display:inline-block;background-color:${BRAND.primary};color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:999px;font-size:15px;font-weight:400;min-height:44px;line-height:1.2;">式場さがしに合流する</a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;line-height:1.6;color:${BRAND.muted};padding-bottom:16px;">
                うまく開けない場合は、以下のURLをコピーしてブラウザに貼り付けてください。<br/>
                <a href="${encodeURI(inviteUrl)}" style="color:${BRAND.goldWarm};text-decoration:underline;word-break:break-all;">${escapeHtml(inviteUrl)}</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:0.5px solid ${BRAND.goldSubtle};padding-top:16px;font-size:11px;line-height:1.6;color:${BRAND.muted};">
                このメールに心当たりがない場合は破棄してください。<br/>
                Haretoki — 式場選びを、もっと納得のいくものに。
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${inviterName}さんから招待が届いています（Haretoki）`,
    "",
    `${inviterName}さんが「${projectName}」におふたりを招ばれました。`,
    "下の URL から、ふたりの式場さがしに合流してください。",
    "",
    inviteUrl,
    "",
    "このメールに心当たりがない場合は破棄してください。",
    "Haretoki",
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
