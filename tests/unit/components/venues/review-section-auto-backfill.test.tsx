import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";

/**
 * Auto-backfill behavior in <ReviewSection>.
 *
 * The component should auto-fire `extractIndividualReviewsFromSource`
 * once per (mounted, venueId) pair when the venue still has summary
 * rows lacking individual review bodies. This guards against the
 * 2026-05-10 user feedback: "ポジ 1・ネガ 0… さらなる操作が必要なんだっけ"
 * where the deep crawl was hidden behind a manual button.
 *
 * Contract:
 * - sourcesNeedingBackfill ≥ 1 + first mount → fires once
 * - sourcesNeedingBackfill === 0 → never fires (e.g. individuals already
 *   exist for every summary)
 * - same venueId, re-render → does NOT fire a second time
 * - venueId changes (user navigates to another venue) → fires again for
 *   the new venue
 */

// --- Mocks (must be hoisted-safe; vi.hoisted keeps fn identities) ---
const { extractMock, analyzeMock, batchMock, toastMock } = vi.hoisted(() => ({
  extractMock: vi.fn(),
  analyzeMock: vi.fn(),
  batchMock: vi.fn(),
  toastMock: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/server/actions/reviews", () => ({
  extractIndividualReviewsFromSource: extractMock,
  analyzeVenueReviews: analyzeMock,
  batchAnalyzeVenueReviews: batchMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
  Toaster: () => null,
}));

// Heavy children we don't need to exercise here
vi.mock("@/components/ai/insight-card", () => ({
  AIInsightCard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="ai-insight-card">{children}</div>
  ),
}));
vi.mock("@/components/venues/review-estimate-edit-sheet", () => ({
  ReviewEstimateEditSheet: () => <div data-testid="estimate-edit-sheet" />,
}));
vi.mock("@/components/venues/batch-review-import-sheet", () => ({
  BatchReviewImportSheet: () => <div data-testid="batch-import-sheet" />,
}));

import { ReviewSection } from "@/components/venues/review-section";

type Review = Parameters<typeof ReviewSection>[0]["reviews"][number];

function summaryRow(overrides: Partial<Review> = {}): Review {
  return {
    id: "summary-1",
    source: "zexy",
    sourceUrl: "https://zexy.net/wedding/c_1234567890/kuchikomi/",
    aiSummary: "サンプル要約",
    sentiment: { overall: 0.4 },
    rating: 4.0,
    categorySummary: { service: "良い" },
    isNegative: false,
    estimateIncrease: null,
    ...overrides,
  };
}

function individualRow(overrides: Partial<Review> = {}): Review {
  return {
    id: "ind-1",
    source: "zexy",
    sourceUrl:
      "https://zexy.net/wedding/c_1234567890/kuchikomi/#rev-abcd1234",
    aiSummary: "本文",
    sentiment: { overall: 0.5 },
    rating: 5.0,
    categorySummary: {
      individual: { title: "素敵", author: "A", visitedAt: "2026-01" },
    },
    isNegative: false,
    estimateIncrease: null,
    ...overrides,
  };
}

beforeEach(() => {
  extractMock.mockReset();
  analyzeMock.mockReset();
  batchMock.mockReset();
  toastMock.info.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  toastMock.warning.mockReset();
  // Default extract behavior: success with 25 saved
  extractMock.mockResolvedValue({ ok: true, saved: 25, alreadyHad: 0 });
});

afterEach(() => {
  cleanup();
});

describe("ReviewSection auto-backfill on mount", () => {
  it("fires extractIndividualReviewsFromSource when summary lacks individuals", async () => {
    render(
      <ReviewSection venueId="venue-A" reviews={[summaryRow()]} />,
    );
    await waitFor(() => {
      expect(extractMock).toHaveBeenCalledTimes(1);
      expect(extractMock).toHaveBeenCalledWith("summary-1");
    });
    expect(toastMock.info).toHaveBeenCalledWith(
      expect.stringContaining("自動で取り込んでいます"),
    );
  });

  it("does NOT fire when every summary already has individual rows", async () => {
    const summary = summaryRow();
    const ind = individualRow();
    render(
      <ReviewSection
        venueId="venue-A"
        reviews={[summary, ind]}
      />,
    );
    // Give React a tick — the effect should bail out, not pend.
    await new Promise((r) => setTimeout(r, 30));
    expect(extractMock).not.toHaveBeenCalled();
  });

  it("does NOT re-fire on a re-render of the same venueId", async () => {
    const { rerender } = render(
      <ReviewSection venueId="venue-A" reviews={[summaryRow()]} />,
    );
    await waitFor(() => expect(extractMock).toHaveBeenCalledTimes(1));

    // Re-render with the same props (e.g. a parent state update). The
    // effect must read the useRef guard and bail.
    rerender(
      <ReviewSection venueId="venue-A" reviews={[summaryRow()]} />,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(extractMock).toHaveBeenCalledTimes(1);
  });

  it("DOES re-fire when navigating to a different venueId", async () => {
    const { rerender } = render(
      <ReviewSection
        venueId="venue-A"
        reviews={[summaryRow({ id: "summary-A" })]}
      />,
    );
    await waitFor(() => expect(extractMock).toHaveBeenCalledTimes(1));
    expect(extractMock).toHaveBeenLastCalledWith("summary-A");

    rerender(
      <ReviewSection
        venueId="venue-B"
        reviews={[summaryRow({ id: "summary-B" })]}
      />,
    );
    await waitFor(() => expect(extractMock).toHaveBeenCalledTimes(2));
    expect(extractMock).toHaveBeenLastCalledWith("summary-B");
  });

  it("does NOT fire when there are zero summary rows at all", async () => {
    render(<ReviewSection venueId="venue-A" reviews={[]} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(extractMock).not.toHaveBeenCalled();
  });
});
