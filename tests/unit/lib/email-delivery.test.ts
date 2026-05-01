import { describe, it, expect } from "vitest";
import {
  EMAIL_DELIVERY_STATUSES,
  eventTypeToStatus,
  isSuppressingStatus,
  type EmailDeliveryStatus,
} from "@/lib/email/delivery";

describe("email/delivery: eventTypeToStatus", () => {
  it("maps each Resend event type to its EmailDeliveryStatus tail", () => {
    for (const status of EMAIL_DELIVERY_STATUSES) {
      expect(eventTypeToStatus(`email.${status}`)).toBe(status);
    }
  });

  it("returns null for unknown event types", () => {
    expect(eventTypeToStatus("email.unknown_future_event")).toBeNull();
    expect(eventTypeToStatus("contact.created")).toBeNull();
    expect(eventTypeToStatus("")).toBeNull();
  });

  it("ignores events that don't start with 'email.'", () => {
    expect(eventTypeToStatus("delivered")).toBeNull();
    expect(eventTypeToStatus("emaildelivered")).toBeNull();
  });
});

describe("email/delivery: isSuppressingStatus", () => {
  it("flags bounced + complained as suppressing", () => {
    expect(isSuppressingStatus("bounced")).toBe(true);
    expect(isSuppressingStatus("complained")).toBe(true);
  });

  it("does NOT flag transient or positive statuses as suppressing", () => {
    const nonSuppressing: EmailDeliveryStatus[] = [
      "sent",
      "delivered",
      "delivery_delayed",
      "opened",
      "clicked",
    ];
    for (const status of nonSuppressing) {
      expect(isSuppressingStatus(status)).toBe(false);
    }
  });

  it("specifically does NOT suppress on delivery_delayed (transient)", () => {
    // Regression guard: an earlier draft included delayed in the
    // suppression set; that would mute users on temporary recipient-MX
    // congestion. Pinning the explicit "no" here so the next refactor
    // doesn't regress.
    expect(isSuppressingStatus("delivery_delayed")).toBe(false);
  });
});

describe("email/delivery: EMAIL_DELIVERY_STATUSES constant", () => {
  it("covers all 7 Resend webhook event types we subscribe to", () => {
    // Per Resend docs (Context7 verified 2026-05-02): sent, delivered,
    // delivery_delayed, bounced, complained, opened, clicked.
    expect(new Set(EMAIL_DELIVERY_STATUSES)).toEqual(
      new Set([
        "sent",
        "delivered",
        "delivery_delayed",
        "bounced",
        "complained",
        "opened",
        "clicked",
      ]),
    );
  });
});
