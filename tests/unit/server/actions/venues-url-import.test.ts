import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the whole external surface of confirmVenueFromUrl so we can assert
// the orchestration: photo download → venue.create → saveExtractedReviews
// → analyzeVenueReviews is dispatched fire-and-forget.

const mockVenueCreate = vi.fn();
const mockVenueUpdate = vi.fn();
const mockVenueFindMany = vi.fn();
const mockVenueFindUniqueOrThrow = vi.fn();
const mockReviewUpsert = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      create: (...args: unknown[]) => mockVenueCreate(...args),
      update: (...args: unknown[]) => mockVenueUpdate(...args),
      findMany: (...args: unknown[]) => mockVenueFindMany(...args),
      findUniqueOrThrow: (...args: unknown[]) =>
        mockVenueFindUniqueOrThrow(...args),
    },
    review: {
      upsert: (...args: unknown[]) => mockReviewUpsert(...args),
    },
    venueFavorite: {
      // auto-favorite on create/merge needs this to be a no-op upsert.
      upsert: vi.fn(async () => ({
        venueId: "v-mock",
        userId: "user-1",
        createdAt: new Date(),
      })),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockUploadVenuePhotoFromUrl = vi.fn();
vi.mock("@/lib/supabase/storage", () => ({
  uploadVenuePhotoFromUrl: (...args: unknown[]) =>
    mockUploadVenuePhotoFromUrl(...args),
  uploadVenuePhoto: vi.fn(),
  uploadChecklistPhoto: vi.fn(),
  uploadEstimatePdf: vi.fn(),
  downloadEstimatePdf: vi.fn(),
}));

// The analyzeVenueReviews path is imported dynamically inside the action
// via `import("@/server/actions/reviews")`, which Vitest resolves to the
// real module. We stub the module up-front so the fire-and-forget call
// doesn't try to hit Claude or Prisma.
// Mock returns the new Result shape ({ok:true}) on the happy path so
// the confirm action records reviewSummaryStatus === "completed".
// Typed as the union so `.mockResolvedValueOnce` can return a failure
// Result in the timeout/api-error tests below.
type AnalyzeResult =
  | { ok: true }
  | { ok: false; reason: "timeout" | "api-error" | "no-reviews" };
const mockAnalyzeVenueReviews = vi.fn<
  (...args: unknown[]) => Promise<AnalyzeResult>
>(async (..._args: unknown[]) => ({ ok: true }));
vi.mock("@/server/actions/reviews", async () => {
  const actual =
    await vi.importActual<typeof import("@/server/actions/reviews")>(
      "@/server/actions/reviews",
    );
  return {
    ...actual,
    analyzeVenueReviews: (...args: unknown[]) =>
      mockAnalyzeVenueReviews(...args),
  };
});

// Guard against network — reviewSourceFromUrl is purely hostname regex.
vi.mock("@/lib/url-guard", () => ({
  guardExternalUrl: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: vi.fn(),
}));

const mockCaptureMessage = vi.fn();
const mockCaptureError = vi.fn();
vi.mock("@/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

describe("confirmVenueFromUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVenueCreate.mockResolvedValue({ id: "venue-1", photoUrls: [] });
    mockVenueUpdate.mockResolvedValue({ id: "venue-1" });
    mockVenueFindMany.mockResolvedValue([]); // default: no dedupe match
    mockVenueFindUniqueOrThrow.mockResolvedValue({ id: "venue-1" });
    mockReviewUpsert.mockResolvedValue({ id: "rev-1" });
    mockUploadVenuePhotoFromUrl.mockImplementation(async (src: string) => ({
      ok: true as const,
      url: src.replace("https://cdn.zexy.net", "https://supabase.co/storage"),
      srcUrl: src,
    }));
  });

  it("persists expanded fields, downloads photos, saves individual reviews", async () => {
    const { confirmVenueFromUrl } = await import(
      "@/server/actions/venues"
    );
    const extracted = {
      name: "南青山ル・アンジェ教会",
      location: "東京都港区南青山",
      accessInfo: "表参道駅 徒歩5分",
      capacityMin: 20,
      capacityMax: 120,
      ceremonyStyles: ["チャペル", "人前"],
      estimatedPrice: 3500000,
      features: ["自然光のチャペル"],
      photoUrls: [
        "https://cdn.zexy.net/p/wedding/0000009738/1006450858/images/001008690607.jpg",
        "https://cdn.zexy.net/p/wedding/0000009738/1006450858/images/001008690613.jpg",
      ],
      confidence: "high" as const,
      costMin: 3000000,
      costMax: 4000000,
      paymentMethodEnums: ["credit_card", "bank_transfer"] as (
        | "credit_card"
        | "cash"
        | "bank_transfer"
        | "installment"
      )[],
      dressBringIn: "negotiable" as const,
      dressBringInFee: null,
      maxInstallments: 12,
      vibeTags: ["chapel", "natural_light", "garden"],
      reviews: [
        {
          title: "素敵な式でした",
          body: "チャペルの自然光が本当に美しく、参列者全員が感動してくれました。スタッフの対応も丁寧で安心して当日を迎えられました。",
          rating: 5,
          author: "yuka_w",
          visitedAt: "2024年5月",
        },
        {
          title: null,
          body: "料理がとても美味しかったです。ゲストからもたくさん褒めていただきました。",
          rating: 4,
          author: null,
          visitedAt: "2024年3月",
        },
      ],
    };
    const sourceUrl = "https://zexy.net/wedding/c_7770029193/";

    const result = await confirmVenueFromUrl(extracted, sourceUrl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.mode).toBe("created");
      expect(result.updatedFields).toEqual([]);
    }
    // Venue was created with every new field mapped through.
    expect(mockVenueCreate).toHaveBeenCalledTimes(1);
    const createArg = mockVenueCreate.mock.calls[0][0].data;
    expect(createArg).toMatchObject({
      projectId: "proj-1",
      name: "南青山ル・アンジェ教会",
      costMin: 3000000,
      costMax: 4000000,
      paymentMethodEnums: ["credit_card", "bank_transfer"],
      dressBringIn: "negotiable",
      maxInstallments: 12,
      vibeTags: ["chapel", "natural_light", "garden"],
      photoUrls: [], // starts empty, patched after upload
    });

    // Both photos were attempted via uploadVenuePhotoFromUrl.
    expect(mockUploadVenuePhotoFromUrl).toHaveBeenCalledTimes(2);
    // Successful uploads are written back via venue.update.
    expect(mockVenueUpdate).toHaveBeenCalledTimes(1);
    expect(mockVenueUpdate.mock.calls[0][0].data.photoUrls).toHaveLength(2);
    expect(mockVenueUpdate.mock.calls[0][0].data.photoUrls[0]).toMatch(
      /^https:\/\/supabase\.co\//,
    );

    // Both individual reviews upserted as separate Review rows, each with a
    // distinct `#rev-{hash}` fragment on the sourceUrl — guarantees that
    // re-importing the same page stays idempotent.
    expect(mockReviewUpsert).toHaveBeenCalledTimes(2);
    const seenSourceUrls = mockReviewUpsert.mock.calls.map(
      (c) => c[0].where.venueId_source_sourceUrl.sourceUrl,
    );
    expect(new Set(seenSourceUrls).size).toBe(2);
    seenSourceUrls.forEach((u) =>
      expect(u).toMatch(/^https:\/\/zexy\.net\/.+#rev-[a-f0-9]{8}$/),
    );

    // Reports back photo counts for the UI progress stage.
    if (result.success) {
      expect(result.photoRequestedCount).toBe(2);
      expect(result.photoUploadedCount).toBe(2);
      expect(result.individualReviewCount).toBe(2);
      // Review summarization is now awaited inside confirmVenueFromUrl —
      // with a happy-path analyzer mock that returns {ok:true}, the
      // caller should receive reviewSummaryStatus === "completed" so the
      // sheet can render the full success toast.
      expect(result.reviewSummaryStatus).toBe("completed");
    }
    // analyzeVenueReviews should have been invoked exactly once (no more
    // fire-and-forget) with the venue id + source url.
    expect(mockAnalyzeVenueReviews).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeVenueReviews).toHaveBeenCalledWith(
      "venue-1",
      "https://zexy.net/wedding/c_7770029193/",
      "zexy",
    );
  });

  it("creates venue even when every photo upload fails, and keeps 403 URLs as next/image fallback (P8-B)", async () => {
    mockUploadVenuePhotoFromUrl.mockResolvedValue({
      ok: false as const,
      reason: "403" as const,
      srcUrl: "https://cdn.example.com/a.jpg",
      detail: "status=403",
    });
    const { confirmVenueFromUrl } = await import(
      "@/server/actions/venues"
    );
    const extracted = {
      name: "X",
      location: null,
      accessInfo: null,
      capacityMin: null,
      capacityMax: null,
      ceremonyStyles: [],
      estimatedPrice: null,
      features: [],
      photoUrls: ["https://cdn.example.com/a.jpg"],
      confidence: "low" as const,
      costMin: null,
      costMax: null,
      paymentMethodEnums: [],
      dressBringIn: null,
      dressBringInFee: null,
      maxInstallments: null,
      vibeTags: [],
      reviews: [],
    };
    const result = await confirmVenueFromUrl(
      extracted,
      "https://example.com/x",
    );

    expect(result.success).toBe(true);
    // P8-B: 403 is a recoverable reason so the original CDN URL is retained
    // for next/image to fetch server-side. venue.update gets the URL list,
    // photoUploadedCount counts what we kept, and photoFailedReasons still
    // records the underlying Supabase upload failure so telemetry is honest.
    expect(mockVenueUpdate).toHaveBeenCalledOnce();
    const updateCall = mockVenueUpdate.mock.calls[0][0] as {
      data: { photoUrls: string[] };
    };
    expect(updateCall.data.photoUrls).toEqual(["https://cdn.example.com/a.jpg"]);
    if (result.success) {
      expect(result.photoUploadedCount).toBe(1);
      expect(result.photoRequestedCount).toBe(1);
      expect(result.photoFailedReasons).toEqual({
        "403": 1,
        timeout: 0,
        "invalid-ct": 0,
        "size-limit": 0,
        network: 0,
      });
      // Phase C: no reviews extracted → summarization is skipped entirely.
      expect(result.reviewSummaryStatus).toBe("skipped");
    }
    expect(mockAnalyzeVenueReviews).not.toHaveBeenCalled();
  });

  it("surfaces reviewSummaryStatus='timeout' when the analyzer times out", async () => {
    // Analyzer returns the {ok:false, reason:'timeout'} Result — simulates
    // the 15s budget elapsing inside analyzeVenueReviews.
    mockAnalyzeVenueReviews.mockResolvedValueOnce({
      ok: false,
      reason: "timeout",
    });
    const { confirmVenueFromUrl } = await import(
      "@/server/actions/venues"
    );
    const extracted = {
      name: "Timeout Venue",
      location: null,
      accessInfo: null,
      capacityMin: null,
      capacityMax: null,
      ceremonyStyles: [],
      estimatedPrice: null,
      features: [],
      photoUrls: [],
      confidence: "medium" as const,
      costMin: null,
      costMax: null,
      paymentMethodEnums: [],
      dressBringIn: null,
      dressBringInFee: null,
      maxInstallments: null,
      vibeTags: [],
      reviews: [
        {
          title: null,
          body: "This is a review body that will trigger the summary step.",
          rating: 4,
          author: null,
          visitedAt: null,
        },
      ],
    };

    const result = await confirmVenueFromUrl(
      extracted,
      "https://zexy.net/wedding/c_slow/",
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.reviewSummaryStatus).toBe("timeout");
      expect(result.individualReviewCount).toBe(1);
    }
    // Reviews were saved before the summary step so the UI can still
    // render them — the "timeout" only affects the aggregate summary.
    expect(mockReviewUpsert).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeVenueReviews).toHaveBeenCalledTimes(1);
  });

  it("emits aggregate pipeline summary as info Sentry event on a healthy batch", async () => {
    const { confirmVenueFromUrl } = await import(
      "@/server/actions/venues"
    );
    const extracted = {
      name: "Summary Venue",
      location: null,
      accessInfo: null,
      capacityMin: null,
      capacityMax: null,
      ceremonyStyles: [],
      estimatedPrice: null,
      features: [],
      photoUrls: [
        "https://cdn.zexy.net/photo-a.jpg",
        "https://cdn.zexy.net/photo-b.jpg",
      ],
      confidence: "high" as const,
      costMin: null,
      costMax: null,
      paymentMethodEnums: [],
      dressBringIn: null,
      dressBringInFee: null,
      maxInstallments: null,
      vibeTags: [],
      reviews: [],
    };

    await confirmVenueFromUrl(extracted, "https://zexy.net/wedding/c_1/");

    // Exactly one summary event should be emitted per confirm call. The
    // per-failure warning channel is separate and only fires when an upload
    // fails — on this healthy path it should stay silent.
    const summaryEvents = mockCaptureMessage.mock.calls.filter(
      ([name]) => name === "url_import_photos_summary",
    );
    expect(summaryEvents).toHaveLength(1);
    const [, opts] = summaryEvents[0] as [
      string,
      { level: string; extra: Record<string, unknown> },
    ];
    expect(opts.level).toBe("info");
    expect(opts.extra).toMatchObject({
      mode: "create",
      venueId: "venue-1",
      sourceHost: "zexy.net",
      requestedCount: 2,
      uploadedCount: 2,
      successRate: 1,
    });
    // No silent-failure event on a healthy batch.
    expect(
      mockCaptureMessage.mock.calls.some(
        ([name]) => name === "url_import_photos_silent_failure",
      ),
    ).toBe(false);
  });

  it("escalates to silent-failure Sentry warning when 0/N photos upload", async () => {
    // All uploads fail terminally (no fallback URL retained — timeout is
    // classified as "don't keep original" so uploadedCount stays at 0).
    mockUploadVenuePhotoFromUrl.mockImplementation(async (src: string) => ({
      ok: false as const,
      reason: "timeout" as const,
      srcUrl: src,
      detail: "TimeoutError",
    }));
    const { confirmVenueFromUrl } = await import(
      "@/server/actions/venues"
    );
    const extracted = {
      name: "Silent Fail Venue",
      location: null,
      accessInfo: null,
      capacityMin: null,
      capacityMax: null,
      ceremonyStyles: [],
      estimatedPrice: null,
      features: [],
      photoUrls: [
        "https://cdn.slow.example.com/a.jpg",
        "https://cdn.slow.example.com/b.jpg",
      ],
      confidence: "medium" as const,
      costMin: null,
      costMax: null,
      paymentMethodEnums: [],
      dressBringIn: null,
      dressBringInFee: null,
      maxInstallments: null,
      vibeTags: [],
      reviews: [],
    };

    await confirmVenueFromUrl(
      extracted,
      "https://zexy.net/wedding/c_slow/",
    );

    const silentEvents = mockCaptureMessage.mock.calls.filter(
      ([name]) => name === "url_import_photos_silent_failure",
    );
    expect(silentEvents).toHaveLength(1);
    const [, opts] = silentEvents[0] as [
      string,
      { level: string; extra: Record<string, unknown> },
    ];
    expect(opts.level).toBe("warning");
    expect(opts.extra).toMatchObject({
      mode: "create",
      requestedCount: 2,
      uploadedCount: 0,
      successRate: 0,
      failedReasons: {
        "403": 0,
        timeout: 2,
        "invalid-ct": 0,
        "size-limit": 0,
        network: 0,
      },
    });
  });
});
