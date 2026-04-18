import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for `uploadVenuePhotoFromUrl` focus on:
 *  - Result shape (ok:true vs ok:false with discriminated reason)
 *  - Retry ladder (desktop w/ referer → desktop no referer → mobile Safari)
 *  - Header correctness (Sec-Fetch-*, Accept-Language ja, UA per attempt)
 *  - Failure classification (403 / timeout / invalid-ct / size-limit / network)
 */

const getPublicUrlMock = vi.fn(() => ({
  data: { publicUrl: "https://supabase.co/storage/v1/object/public/venue-photos/imported.jpg" },
}));
const uploadMock = vi.fn(async () => ({ data: { path: "p/v/imported.jpg" }, error: null }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));

// Minimal ReadableStream body used by every fetch mock.
function makeBody(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function makeImageResponse(opts: {
  status?: number;
  contentType?: string;
  size?: number;
}): Response {
  const bytes = new Uint8Array(opts.size ?? 1024);
  return new Response(makeBody(bytes), {
    status: opts.status ?? 200,
    headers: { "content-type": opts.contentType ?? "image/jpeg" },
  });
}

describe("uploadVenuePhotoFromUrl", () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    uploadMock.mockClear();
    getPublicUrlMock.mockClear();
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("succeeds on first attempt and returns ok:true with Supabase URL", async () => {
    fetchMock.mockResolvedValueOnce(makeImageResponse({}));
    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");

    const result = await uploadVenuePhotoFromUrl(
      "https://cdn.zexy.net/a.jpg",
      "proj-1",
      "venue-1",
      "https://zexy.net/",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toMatch(/^https:\/\/supabase\.co\//);
      expect(result.srcUrl).toBe("https://cdn.zexy.net/a.jpg");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Verify header set includes our browser-mimicking headers.
    const sentInit = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = sentInit.headers as Record<string, string>;
    expect(headers["Sec-Fetch-Dest"]).toBe("image");
    expect(headers["Sec-Fetch-Mode"]).toBe("no-cors");
    expect(headers["Sec-Fetch-Site"]).toBe("cross-site");
    expect(headers["Accept-Language"]).toMatch(/^ja/);
    expect(headers["User-Agent"]).toMatch(/Chrome/);
    expect(headers.Referer).toBe("https://zexy.net/");
  });

  it("retries without Referer after 403, and escalates to mobile Safari UA", async () => {
    fetchMock
      .mockResolvedValueOnce(makeImageResponse({ status: 403 }))
      .mockResolvedValueOnce(makeImageResponse({ status: 403 }))
      .mockResolvedValueOnce(makeImageResponse({}));
    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");

    const result = await uploadVenuePhotoFromUrl(
      "https://cdn.zexy.net/b.jpg",
      "proj-1",
      "venue-1",
      "https://zexy.net/",
    );

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const attempts = fetchMock.mock.calls.map(
      (c) => (c[1] as RequestInit).headers as Record<string, string>,
    );
    // Attempt 1: desktop chrome with Referer
    expect(attempts[0].Referer).toBe("https://zexy.net/");
    expect(attempts[0]["User-Agent"]).toMatch(/Chrome/);
    // Attempt 2: desktop chrome without Referer
    expect(attempts[1].Referer).toBeUndefined();
    expect(attempts[1]["User-Agent"]).toMatch(/Chrome/);
    // Attempt 3: mobile Safari with Referer
    expect(attempts[2]["User-Agent"]).toMatch(/iPhone.*Safari/);
    expect(attempts[2].Referer).toBe("https://zexy.net/");
  });

  it("returns reason:'403' when all 3 attempts return 403", async () => {
    fetchMock.mockResolvedValue(makeImageResponse({ status: 403 }));
    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");

    const result = await uploadVenuePhotoFromUrl(
      "https://cdn.example.com/x.jpg",
      "p",
      "v",
      "https://example.com/",
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        reason: "403",
        srcUrl: "https://cdn.example.com/x.jpg",
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns reason:'invalid-ct' without retrying (terminal failure)", async () => {
    fetchMock.mockResolvedValue(
      makeImageResponse({ contentType: "text/html" }),
    );
    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");

    const result = await uploadVenuePhotoFromUrl(
      "https://cdn.example.com/antihotlink.html",
      "p",
      "v",
    );

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "invalid-ct" }),
    );
    // No retry — same content-type will reject the same way.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns reason:'size-limit' when image exceeds 5 MB", async () => {
    fetchMock.mockResolvedValue(
      makeImageResponse({ size: 6 * 1024 * 1024 }),
    );
    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");

    const result = await uploadVenuePhotoFromUrl(
      "https://cdn.example.com/huge.jpg",
      "p",
      "v",
    );

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "size-limit" }),
    );
    // size-limit is terminal too.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns reason:'timeout' when all attempts throw TimeoutError", async () => {
    const timeoutErr = new Error("signal timed out");
    timeoutErr.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeoutErr);

    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");
    const result = await uploadVenuePhotoFromUrl(
      "https://cdn.slow.com/s.jpg",
      "p",
      "v",
    );

    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "timeout" }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns reason:'network' for invalid URL without fetching", async () => {
    const { uploadVenuePhotoFromUrl } = await import("@/lib/supabase/storage");
    const result = await uploadVenuePhotoFromUrl(
      "not-a-url",
      "p",
      "v",
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "network" }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
