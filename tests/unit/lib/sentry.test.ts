import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// @sentry/nextjs exports are non-configurable ESM bindings, so vi.spyOn won't
// work on them. Mock the module wholesale and re-import the util under test
// to assert pass-through behaviour.
const captureExceptionMock = vi.fn();
const captureMessageSdkMock = vi.fn();
const withScopeMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  captureMessage: captureMessageSdkMock,
  withScope: withScopeMock,
}));

describe("captureError", () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    captureExceptionMock.mockReset();
    captureMessageSdkMock.mockReset();
    withScopeMock.mockReset();
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it("is a no-op when DSN is unset", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { captureError } = await import("@/lib/sentry");

    captureError(new Error("boom"), { action: "test" });

    expect(withScopeMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("legacy positional extras still work (backward-compat)", async () => {
    // Existing call sites pass `{ action: "...", foo: "bar" }` directly —
    // the helper must move that bag into `extras` on the scope instead of
    // dropping it. Pinning here so the round-12 refactor (component +
    // alertRoute tags) doesn't break unmigrated call sites.
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setTag = vi.fn();
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag, setExtras });
    });

    const { captureError } = await import("@/lib/sentry");
    const err = new Error("boom");
    captureError(err, { action: "test", foo: "bar" });

    expect(withScopeMock).toHaveBeenCalledTimes(1);
    expect(setExtras).toHaveBeenCalledWith({ action: "test", foo: "bar" });
    // No structured tags applied for the legacy shape.
    expect(setTag).not.toHaveBeenCalled();
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
  });

  it("structured options apply `component` + `alert_route` tags", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setTag = vi.fn();
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag, setExtras });
    });

    const { captureError } = await import("@/lib/sentry");
    const err = new Error("boom");
    captureError(err, {
      component: "cron.visit-reminder",
      alertRoute: "p2-email",
      extra: { phase: "day_before" },
    });

    expect(setTag).toHaveBeenCalledWith("component", "cron.visit-reminder");
    expect(setTag).toHaveBeenCalledWith("alert_route", "p2-email");
    expect(setExtras).toHaveBeenCalledWith({ phase: "day_before" });
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
  });

  it("structured options omit tags when not supplied", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setTag = vi.fn();
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag, setExtras });
    });

    const { captureError } = await import("@/lib/sentry");
    captureError(new Error("boom"), { extra: { x: 1 } });

    expect(setTag).not.toHaveBeenCalled();
    expect(setExtras).toHaveBeenCalledWith({ x: 1 });
  });
});

describe("captureMessage", () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    captureMessageSdkMock.mockReset();
    captureExceptionMock.mockReset();
    withScopeMock.mockReset();
  });

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it("is a no-op when DSN is unset", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { captureMessage } = await import("@/lib/sentry");
    captureMessage("hi", { level: "warning" });
    expect(captureMessageSdkMock).not.toHaveBeenCalled();
  });

  it("forwards level to the SDK and applies tags", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setTag = vi.fn();
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag, setExtras });
    });

    const { captureMessage } = await import("@/lib/sentry");
    captureMessage("warn", {
      level: "error",
      component: "webhook.resend",
      alertRoute: "p1-page",
    });
    expect(captureMessageSdkMock).toHaveBeenCalledWith("warn", "error");
    expect(setTag).toHaveBeenCalledWith("component", "webhook.resend");
    expect(setTag).toHaveBeenCalledWith("alert_route", "p1-page");
  });

  it("defaults level to 'warning' when omitted", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setTag = vi.fn();
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag, setExtras });
    });

    const { captureMessage } = await import("@/lib/sentry");
    captureMessage("text", { component: "ai.cache" });
    expect(captureMessageSdkMock).toHaveBeenCalledWith("text", "warning");
  });

  it("legacy `{ level, extra }` shape still works", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setTag = vi.fn();
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setTag, setExtras });
    });

    const { captureMessage } = await import("@/lib/sentry");
    captureMessage("legacy", { level: "info", extra: { foo: "bar" } });
    expect(captureMessageSdkMock).toHaveBeenCalledWith("legacy", "info");
    expect(setExtras).toHaveBeenCalledWith({ foo: "bar" });
    expect(setTag).not.toHaveBeenCalled();
  });
});
