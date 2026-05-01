import { describe, it, expect } from "vitest";
import {
  adminNoticeBody,
  bouncePayloadToReason,
  isPermanentSuppression,
  isRetryableSuppression,
  SOFT_BOUNCE_RETRY_DAYS,
  type SuppressionReason,
} from "@/lib/email/suppression";

describe("email/suppression: bouncePayloadToReason", () => {
  it("maps Resend Permanent → hard_bounce", () => {
    expect(bouncePayloadToReason({ type: "Permanent" })).toBe("hard_bounce");
  });

  it("is case-insensitive on type", () => {
    expect(bouncePayloadToReason({ type: "permanent" })).toBe("hard_bounce");
    expect(bouncePayloadToReason({ type: "PERMANENT" })).toBe("hard_bounce");
  });

  it("maps Resend Transient → soft_bounce", () => {
    expect(bouncePayloadToReason({ type: "Transient" })).toBe("soft_bounce");
  });

  it("maps Resend Undetermined → soft_bounce (conservative)", () => {
    // Critical: an unclassified bounce must NOT permanently suppress
    // — that would silently lock users out on a single ESP glitch.
    expect(bouncePayloadToReason({ type: "Undetermined" })).toBe("soft_bounce");
  });

  it("maps unknown / missing type → soft_bounce (conservative)", () => {
    expect(bouncePayloadToReason({ type: "Future_Subtype" })).toBe(
      "soft_bounce",
    );
    expect(bouncePayloadToReason({})).toBe("soft_bounce");
    expect(bouncePayloadToReason(null)).toBe("soft_bounce");
    expect(bouncePayloadToReason(undefined)).toBe("soft_bounce");
  });
});

describe("email/suppression: isPermanentSuppression", () => {
  it("flags hard_bounce + complained + manual as permanent", () => {
    expect(isPermanentSuppression("hard_bounce")).toBe(true);
    expect(isPermanentSuppression("complained")).toBe(true);
    expect(isPermanentSuppression("manual")).toBe(true);
  });

  it("does NOT flag soft_bounce as permanent", () => {
    // Pin: soft bounces must remain retry-eligible. A regression here
    // would silently lock users out on transient ESP issues.
    expect(isPermanentSuppression("soft_bounce")).toBe(false);
  });
});

describe("email/suppression: isRetryableSuppression", () => {
  it("only soft_bounce is retryable", () => {
    expect(isRetryableSuppression("soft_bounce")).toBe(true);
  });

  it("hard_bounce / complained / manual are NOT retryable", () => {
    const permanents: SuppressionReason[] = ["hard_bounce", "complained", "manual"];
    for (const r of permanents) {
      expect(isRetryableSuppression(r)).toBe(false);
    }
  });

  it("null / undefined are NOT retryable", () => {
    expect(isRetryableSuppression(null)).toBe(false);
    expect(isRetryableSuppression(undefined)).toBe(false);
  });
});

describe("email/suppression: SOFT_BOUNCE_RETRY_DAYS", () => {
  it("is 7 days", () => {
    expect(SOFT_BOUNCE_RETRY_DAYS).toBe(7);
  });
});

describe("email/suppression: adminNoticeBody", () => {
  it("subject mentions reason + user email", () => {
    const { subject } = adminNoticeBody({
      userEmail: "u@x.com",
      reason: "hard_bounce",
      permanent: true,
    });
    expect(subject).toContain("hard_bounce");
    expect(subject).toContain("u@x.com");
  });

  it("text body distinguishes permanent vs transient suppression", () => {
    const permanent = adminNoticeBody({
      userEmail: "u@x.com",
      reason: "hard_bounce",
      permanent: true,
    });
    expect(permanent.text).toContain("yes");

    const transient = adminNoticeBody({
      userEmail: "u@x.com",
      reason: "soft_bounce",
      permanent: false,
    });
    expect(transient.text).toContain("7-day cooldown");
  });

  it("includes details when supplied, omits when absent", () => {
    const withDetails = adminNoticeBody({
      userEmail: "u@x.com",
      reason: "hard_bounce",
      permanent: true,
      details: "Mailbox does not exist",
    });
    expect(withDetails.text).toContain("Mailbox does not exist");

    const withoutDetails = adminNoticeBody({
      userEmail: "u@x.com",
      reason: "hard_bounce",
      permanent: true,
    });
    expect(withoutDetails.text).not.toContain("Details:");
  });
});
