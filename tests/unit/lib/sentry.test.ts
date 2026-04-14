import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// @sentry/nextjs exports are non-configurable ESM bindings, so vi.spyOn won't
// work on them. Mock the module wholesale and re-import the util under test
// to assert pass-through behaviour.
const captureExceptionMock = vi.fn();
const withScopeMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionMock,
  withScope: withScopeMock,
}));

describe("captureError", () => {
  const originalDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
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
    const { captureError } = await import("@/lib/sentry");

    captureError(new Error("boom"), { action: "test" });

    expect(withScopeMock).not.toHaveBeenCalled();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("forwards to Sentry.withScope + captureException when DSN is set", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN =
      "https://example@o0.ingest.sentry.io/0";
    const setExtras = vi.fn();
    withScopeMock.mockImplementation((cb: (scope: unknown) => void) => {
      cb({ setExtras });
    });

    const { captureError } = await import("@/lib/sentry");
    const err = new Error("boom");
    captureError(err, { action: "test", foo: "bar" });

    expect(withScopeMock).toHaveBeenCalledTimes(1);
    expect(setExtras).toHaveBeenCalledWith({ action: "test", foo: "bar" });
    expect(captureExceptionMock).toHaveBeenCalledWith(err);
  });
});
