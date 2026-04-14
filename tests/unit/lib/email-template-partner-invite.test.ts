import { describe, it, expect } from "vitest";
import { renderPartnerInviteEmail } from "@/lib/email/templates/partner-invite";

describe("partner invite email template", () => {
  const sample = {
    inviterName: "佐藤 健",
    projectName: "2026年春の式",
    inviteUrl: "https://haretoki.vercel.app/accept-invite",
  };

  it("subject includes inviter name", () => {
    const { subject } = renderPartnerInviteEmail(sample);
    expect(subject).toContain("佐藤 健");
    expect(subject).toContain("Haretoki");
  });

  it("text body contains invite URL and project name", () => {
    const { text } = renderPartnerInviteEmail(sample);
    expect(text).toContain("2026年春の式");
    expect(text).toContain("https://haretoki.vercel.app/accept-invite");
    expect(text).toContain("佐藤 健");
  });

  it("html body escapes risky characters in inviter name", () => {
    const { html } = renderPartnerInviteEmail({
      ...sample,
      inviterName: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("html button points to inviteUrl (encoded)", () => {
    const { html } = renderPartnerInviteEmail(sample);
    expect(html).toContain('href="https://haretoki.vercel.app/accept-invite"');
  });
});
