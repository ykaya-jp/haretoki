import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logEvent, logEventWithBreadcrumb } from "@/lib/observability";

/**
 * Tests for `src/lib/observability.ts`. Pin the JSON shape (single line,
 * `event` key first, no nested wrapping) since Vercel Log Drain consumers
 * parse by string-prefix and would silently break on shape drift.
 */

describe("observability/logEvent", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    // Without restore the spy persists across tests, so a later test's
    // call count includes prior tests' invocations and the indexed
    // assertions point at the wrong call.
    infoSpy.mockRestore();
  });

  it("emits a single console.info call per logEvent", () => {
    logEvent({ event: "ai_call", fields: { model: "haiku" } });
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("payload is valid JSON with `event` as the discriminator", () => {
    logEvent({ event: "visit_reminder_cron", fields: { phase: "day_before" } });
    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.event).toBe("visit_reminder_cron");
    expect(parsed.phase).toBe("day_before");
  });

  it("supports calls without fields", () => {
    logEvent({ event: "user_export" });
    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({ event: "user_export" });
  });

  it("ignores caller-supplied `event` inside fields (security)", () => {
    // A regression here would let untrusted call-site code spoof the
    // event taxonomy and break Vercel queries — the helper must always
    // pin `event` to the typed argument.
    logEvent({
      event: "ai_call",
      fields: { event: "user_delete", model: "haiku" },
    });
    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.event).toBe("ai_call");
    expect(parsed.model).toBe("haiku");
  });

  it("passes through nested objects + arrays without truncation", () => {
    logEvent({
      event: "resend_webhook",
      fields: {
        eventType: "email.bounced",
        meta: { reason: "hard-bounce", attempts: [1, 2, 3] },
      },
    });
    const raw = infoSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.meta.reason).toBe("hard-bounce");
    expect(parsed.meta.attempts).toEqual([1, 2, 3]);
  });
});

describe("observability/logEventWithBreadcrumb", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it("still emits the structured log line (Sentry breadcrumb is additive)", () => {
    logEventWithBreadcrumb({
      event: "botid_block",
      fields: { scope: "coach-stream" },
    });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(parsed.event).toBe("botid_block");
    expect(parsed.scope).toBe("coach-stream");
  });
});
