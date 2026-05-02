import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Beta feedback server-action coverage.
 *
 * Pinned contracts:
 *   - validation rejects malformed input BEFORE auth + DB
 *   - rate-limit kicks in (shared with /support)
 *   - audit row written with meta-only detail (no body content)
 *   - email failure / no-email-infra still returns success=true
 *     (recoverability contract — operator picks up from the server log)
 */

const mockRequireUser = vi.fn();
const mockSendEmail = vi.fn();
const mockIsEmailAvailable = vi.fn();
const mockCheckSupportRateLimit = vi.fn();
const mockRecordAudit = vi.fn();

vi.mock("@/server/auth", () => ({
  requireUser: (...a: unknown[]) => mockRequireUser(...a),
}));

vi.mock("@/server/audit", () => ({
  recordAudit: (...a: unknown[]) => mockRecordAudit(...a),
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
  isEmailAvailable: (...a: unknown[]) => mockIsEmailAvailable(...a),
}));

vi.mock("@/lib/support/rate-limit", () => ({
  checkSupportRateLimit: (...a: unknown[]) => mockCheckSupportRateLimit(...a),
}));

vi.mock("next/headers", () => ({
  headers: () =>
    Promise.resolve({
      get: (n: string) => (n.toLowerCase() === "user-agent" ? "Test UA" : null),
    }),
}));

import { submitFeedback } from "@/server/actions/feedback";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1", email: "u@example.com" });
  mockCheckSupportRateLimit.mockReturnValue({ ok: true });
  mockIsEmailAvailable.mockReturnValue(true);
  mockSendEmail.mockResolvedValue({ success: true });
});

describe("submitFeedback — validation", () => {
  it("rejects subject under 2 chars BEFORE auth + DB", async () => {
    const r = await submitFeedback({ subject: "a", body: "this is long enough" });
    expect(r.success).toBe(false);
    expect(mockRequireUser).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRecordAudit).not.toHaveBeenCalled();
  });

  it("rejects body under 10 chars", async () => {
    const r = await submitFeedback({ subject: "valid subject", body: "short" });
    expect(r.success).toBe(false);
    expect(mockRequireUser).not.toHaveBeenCalled();
  });

  it("rejects malformed contact email", async () => {
    const r = await submitFeedback({
      subject: "valid",
      body: "valid body content here",
      contact: "not-an-email",
    });
    expect(r.success).toBe(false);
  });

  it("accepts empty contact (= use registered email fallback)", async () => {
    const r = await submitFeedback({
      subject: "Beta thoughts",
      body: "Loving the new countdown widget!",
      contact: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("submitFeedback — rate limit", () => {
  it("returns user-safe error when rate-limited (no audit row, no email)", async () => {
    mockCheckSupportRateLimit.mockReturnValue({ ok: false });

    const r = await submitFeedback({
      subject: "Beta thoughts",
      body: "Loving the new countdown widget!",
    });

    expect(r.success).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockRecordAudit).not.toHaveBeenCalled();
  });
});

describe("submitFeedback — audit + email", () => {
  it("writes audit row with meta-only detail (NO body content)", async () => {
    await submitFeedback({
      subject: "Beta thoughts",
      body: "Loving the new countdown widget!",
      contact: "yuki@example.com",
    });

    expect(mockRecordAudit).toHaveBeenCalledTimes(1);
    const audit = mockRecordAudit.mock.calls[0][0];
    expect(audit.action).toBe("user.feedback.submitted");
    expect(audit.actorId).toBe("user-1");
    expect(audit.actorRole).toBe("user");
    expect(audit.detail).toEqual({
      subject: "Beta thoughts",
      bodyLength: "Loving the new countdown widget!".length,
      hasContact: true,
    });
    // CRITICAL: the body itself MUST NOT be in the audit detail —
    // PII surface, not recovery-load-bearing.
    expect(JSON.stringify(audit.detail)).not.toContain(
      "Loving the new countdown widget",
    );
  });

  it("hasContact=false when contact is empty", async () => {
    await submitFeedback({
      subject: "Beta thoughts",
      body: "Body content here",
      contact: "",
    });
    const audit = mockRecordAudit.mock.calls[0][0];
    expect(audit.detail.hasContact).toBe(false);
  });

  it("sends email to FEEDBACK_EMAIL when email infra is available", async () => {
    process.env.FEEDBACK_EMAIL = "feedback@example.com";
    await submitFeedback({
      subject: "Beta thoughts",
      body: "Body content here",
    });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].to).toBe("feedback@example.com");
    delete process.env.FEEDBACK_EMAIL;
  });

  it("falls back to feedback@haretoki.app when FEEDBACK_EMAIL is unset", async () => {
    delete process.env.FEEDBACK_EMAIL;
    await submitFeedback({
      subject: "Beta thoughts",
      body: "Body content here",
    });
    expect(mockSendEmail.mock.calls[0][0].to).toBe("feedback@haretoki.app");
  });
});

describe("submitFeedback — recoverability contract", () => {
  it("returns success=true when Resend is unavailable (server log + audit are the SoT)", async () => {
    mockIsEmailAvailable.mockReturnValue(false);
    const r = await submitFeedback({
      subject: "Beta thoughts",
      body: "Body content here",
    });
    expect(r.success).toBe(true);
    // Audit row still written so /admin/feedback shows the entry.
    expect(mockRecordAudit).toHaveBeenCalledTimes(1);
    // Email never attempted (no infra).
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns success=true when sendEmail itself fails (matches /support pattern)", async () => {
    mockSendEmail.mockResolvedValue({ success: false, error: "domain unverified" });
    const r = await submitFeedback({
      subject: "Beta thoughts",
      body: "Body content here",
    });
    // Hide infra errors from couples — they can't fix it on their side,
    // and the operator already has the body in the server log.
    expect(r.success).toBe(true);
    expect(mockRecordAudit).toHaveBeenCalledTimes(1);
  });
});
