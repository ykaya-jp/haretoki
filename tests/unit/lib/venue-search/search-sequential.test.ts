import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VenueSearchHit } from "@/lib/venue-search/types";

/**
 * H2 regression: Tier 3 (Claude) must be called ONLY when Tier 2 (Places)
 * returns 0 hits. Parallel invocation was the original bug.
 */

// --- Module mocks (hoisted) -----------------------------------------------

const mockFetchPlacesAutocomplete = vi.fn<() => Promise<VenueSearchHit[]>>();
const mockFetchClaudeFallback = vi.fn<() => Promise<VenueSearchHit[]>>();
const mockIsPlacesConfigured = vi.fn<() => boolean>();
const mockCanCallPlaces = vi.fn<() => Promise<{ allowed: boolean }>>();
const mockIncrementPlacesCounter = vi.fn<() => Promise<void>>();
const mockCheckRateLimit = vi.fn<() => { ok: boolean }>();
const mockCaptureError = vi.fn();

vi.mock("@/lib/venue-search/places", () => ({
  fetchPlacesAutocomplete: (...args: unknown[]) =>
    mockFetchPlacesAutocomplete(...(args as [])),
  isPlacesConfigured: () => mockIsPlacesConfigured(),
}));

vi.mock("@/lib/venue-search/claude-fallback", () => ({
  fetchClaudeFallback: (...args: unknown[]) =>
    mockFetchClaudeFallback(...(args as [])),
}));

vi.mock("@/lib/venue-search/quota", () => ({
  canCallPlaces: (...args: unknown[]) => mockCanCallPlaces(...(args as [])),
  incrementPlacesCounter: (...args: unknown[]) =>
    mockIncrementPlacesCounter(...(args as [])),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...(args as [])),
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({ projectId: "proj-1" })),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// Import AFTER mocks.
import { searchVenuesByName } from "@/server/actions/venue-search";

// ---------------------------------------------------------------------------

function makePlacesHit(name: string): VenueSearchHit {
  return {
    id: `places:${name}`,
    name,
    location: "東京",
    source: "places",
    sourceUrl: null,
    placeId: `pid-${name}`,
    existingVenueId: null,
    confidence: "medium",
  };
}

function makeClaudeHit(name: string): VenueSearchHit {
  return {
    id: `claude:${name}`,
    name,
    location: null,
    source: "claude",
    sourceUrl: `https://example.com/${name}`,
    placeId: null,
    existingVenueId: null,
    confidence: "low",
  };
}

describe("searchVenuesByName — Tier 3 sequential (H2 fix)", () => {
  const SESSION = "sess-abc123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ ok: true });
    mockIsPlacesConfigured.mockReturnValue(true);
    mockCanCallPlaces.mockResolvedValue({ allowed: true });
    mockIncrementPlacesCounter.mockResolvedValue(undefined);
  });

  it("does NOT call Claude when Places returns hits", async () => {
    const placesHits = [makePlacesHit("アニヴェルセル表参道")];
    mockFetchPlacesAutocomplete.mockResolvedValue(placesHits);
    mockFetchClaudeFallback.mockResolvedValue([makeClaudeHit("違う式場")]);

    const result = await searchVenuesByName("アニヴェルセル", SESSION);

    expect(mockFetchClaudeFallback).not.toHaveBeenCalled();
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].source).toBe("places");
  });

  it("calls Claude when Places returns 0 hits", async () => {
    mockFetchPlacesAutocomplete.mockResolvedValue([]);
    const claudeHits = [makeClaudeHit("レストランウエディング試験館")];
    mockFetchClaudeFallback.mockResolvedValue(claudeHits);

    const result = await searchVenuesByName("試験館", SESSION);

    expect(mockFetchClaudeFallback).toHaveBeenCalledOnce();
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].source).toBe("claude");
  });

  it("calls Claude when Places is disabled (not configured)", async () => {
    mockIsPlacesConfigured.mockReturnValue(false);
    const claudeHits = [makeClaudeHit("ホテルパシフィック")];
    mockFetchClaudeFallback.mockResolvedValue(claudeHits);

    const result = await searchVenuesByName("パシフィック", SESSION);

    expect(mockFetchPlacesAutocomplete).not.toHaveBeenCalled();
    expect(mockFetchClaudeFallback).toHaveBeenCalledOnce();
    expect(result.hits[0].source).toBe("claude");
  });

  it("returns empty hits (no Claude) when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ ok: false });

    const result = await searchVenuesByName("テスト式場", SESSION);

    expect(result.throttled).toBe(true);
    expect(result.hits).toHaveLength(0);
    expect(mockFetchPlacesAutocomplete).not.toHaveBeenCalled();
    expect(mockFetchClaudeFallback).not.toHaveBeenCalled();
  });
});
