import { describe, it, expect, beforeEach, vi } from "vitest";

// These tests verify graceful degradation when RESEND_API_KEY is unset.
// The resend package is NOT stubbed here (we want the real module path);
// instead we manipulate process.env before importing send.ts fresh each test.

describe("email/send — RESEND_API_KEY unset", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
  });

  it("isEmailAvailable returns false when key missing", async () => {
    const mod = await import("@/lib/email/send");
    expect(mod.isEmailAvailable()).toBe(false);
  });

  it("sendEmail returns EMAIL_NOT_CONFIGURED when key missing", async () => {
    const mod = await import("@/lib/email/send");
    const result = await mod.sendEmail({
      to: "partner@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    });
    expect(result).toEqual({
      success: false,
      error: "EMAIL_NOT_CONFIGURED",
    });
  });
});
