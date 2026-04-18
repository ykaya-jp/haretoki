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
const mockAnalyzeVenueReviews = vi.fn(
  async (..._args: unknown[]) => ({ success: true }),
);
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

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
  captureMessage: vi.fn(),
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
    }
  });

  it("creates venue even when every photo upload fails", async () => {
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
    // venue.update is never called because no photos succeeded.
    expect(mockVenueUpdate).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.photoUploadedCount).toBe(0);
      expect(result.photoRequestedCount).toBe(1);
      // New failure-reason aggregation: 403 should have a count of 1.
      expect(result.photoFailedReasons).toEqual({
        "403": 1,
        timeout: 0,
        "invalid-ct": 0,
        "size-limit": 0,
        network: 0,
      });
    }
  });
});
