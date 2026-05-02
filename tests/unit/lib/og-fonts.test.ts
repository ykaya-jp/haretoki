import { describe, it, expect, beforeEach, vi } from "vitest";

// Sentry helper is mocked so we can assert on graceful-failure logging
// without a DSN.
const captureMessageMock = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
}));

import { loadGoogleFont, loadGoogleFonts } from "@/lib/og-fonts";

const originalFetch = globalThis.fetch;

function mockFetchOnce(impl: typeof globalThis.fetch) {
  globalThis.fetch = impl as typeof globalThis.fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

describe("loadGoogleFont", () => {
  beforeEach(() => {
    captureMessageMock.mockReset();
    restoreFetch();
  });

  it("returns null without fetching when text is empty", async () => {
    let called = false;
    mockFetchOnce(async () => {
      called = true;
      return new Response("", { status: 200 });
    });
    const font = await loadGoogleFont({
      family: "Noto+Serif+JP",
      weight: 300,
      text: "",
      displayName: "NotoSerifJP",
    });
    expect(font).toBeNull();
    expect(called).toBe(false);
    restoreFetch();
  });

  it("returns null when the CSS endpoint responds non-OK", async () => {
    mockFetchOnce(async () => new Response("", { status: 503 }));
    const font = await loadGoogleFont({
      family: "Noto+Serif+JP",
      weight: 300,
      text: "あ",
      displayName: "NotoSerifJP",
    });
    expect(font).toBeNull();
    restoreFetch();
  });

  it("returns null when the CSS body has no parseable @font-face url", async () => {
    mockFetchOnce(
      async () =>
        new Response("/* no font face here, just a comment */", {
          status: 200,
        }),
    );
    const font = await loadGoogleFont({
      family: "Noto+Serif+JP",
      weight: 300,
      text: "あ",
      displayName: "NotoSerifJP",
    });
    expect(font).toBeNull();
    restoreFetch();
  });

  it("logs to Sentry on network throw and returns null (never throws)", async () => {
    mockFetchOnce(async () => {
      throw new Error("ECONNRESET");
    });
    const font = await loadGoogleFont({
      family: "Noto+Serif+JP",
      weight: 300,
      text: "あ",
      displayName: "NotoSerifJP",
    });
    expect(font).toBeNull();
    expect(captureMessageMock).toHaveBeenCalledTimes(1);
    const [msg, opts] = captureMessageMock.mock.calls[0];
    expect(msg).toMatch(/og-fonts/);
    expect((opts as { level?: string }).level).toBe("info");
    restoreFetch();
  });

  it("returns the loaded font payload on full success path", async () => {
    let callIdx = 0;
    mockFetchOnce(async () => {
      callIdx++;
      if (callIdx === 1) {
        // First call = CSS endpoint
        return new Response(
          `@font-face { font-family: 'Noto Serif JP'; font-style: normal; font-weight: 300; src: url(https://fonts.gstatic.com/s/notoserifjp/foo.woff2) format('woff2'); }`,
          { status: 200 },
        );
      }
      // Second call = the binary
      return new Response(new ArrayBuffer(64), { status: 200 });
    });
    const font = await loadGoogleFont({
      family: "Noto+Serif+JP",
      weight: 300,
      text: "あ",
      displayName: "NotoSerifJP",
    });
    expect(font).not.toBeNull();
    expect(font?.name).toBe("NotoSerifJP");
    expect(font?.weight).toBe(300);
    expect(font?.style).toBe("normal");
    expect(font?.data.byteLength).toBe(64);
    restoreFetch();
  });
});

describe("loadGoogleFonts (batch)", () => {
  beforeEach(() => {
    captureMessageMock.mockReset();
    restoreFetch();
  });

  it("filters out failed loads and keeps successful ones", async () => {
    let callIdx = 0;
    mockFetchOnce(async () => {
      callIdx++;
      // Pattern: (CSS for #1 = OK + valid url) -> (binary for #1 = OK)
      //          (CSS for #2 = 500)
      //          (CSS for #3 = OK + no url match) -> returns null
      if (callIdx === 1) {
        return new Response(
          `@font-face { src: url(https://example/a.woff2) format('woff2'); }`,
          { status: 200 },
        );
      }
      if (callIdx === 2) {
        return new Response(new ArrayBuffer(8), { status: 200 });
      }
      if (callIdx === 3) {
        return new Response("", { status: 500 });
      }
      return new Response("/* no @font-face */", { status: 200 });
    });

    const fonts = await loadGoogleFonts([
      {
        family: "Noto+Serif+JP",
        weight: 300,
        text: "a",
        displayName: "Serif300",
      },
      {
        family: "Noto+Sans+JP",
        weight: 400,
        text: "a",
        displayName: "Sans400",
      },
      {
        family: "Noto+Sans+JP",
        weight: 700,
        text: "a",
        displayName: "Sans700",
      },
    ]);
    expect(fonts).toHaveLength(1);
    expect(fonts[0].name).toBe("Serif300");
    restoreFetch();
  });
});
