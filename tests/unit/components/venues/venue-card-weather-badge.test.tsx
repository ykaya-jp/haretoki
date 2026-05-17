import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

// Sever the Server Action chain (HeartButton → favorites.ts → db.ts →
// Prisma) and the photo carousel's IntersectionObserver path so this
// stays a pure presentational test for the weather-badge overlay.
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/actions/favorites", () => ({
  getFavorites: vi.fn(),
  toggleFavorite: vi.fn(),
}));
vi.mock("@/components/venues/heart-button", () => ({
  HeartButton: () => <button aria-label="お気に入り (stub)" />,
}));
vi.mock("@/components/venues/photo-carousel", () => ({
  PhotoCarousel: ({ alt }: { alt: string }) => (
    <div data-testid="photo-carousel" aria-label={alt} />
  ),
}));
vi.mock("@/components/ui/prefetch-link", () => ({
  PrefetchLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import { VenueCard } from "@/components/venues/venue-card";
import type { CoupleVenueScore } from "@/lib/scoring";

// Minimal venue fixture matching VenueWithScores. Photo array is empty
// so PhotoCarousel renders its placeholder and we don't pull in image
// fixtures; the weather badge sits over the photo container regardless.
function makeVenue() {
  return {
    id: "venue-1",
    name: "テスト式場",
    location: "東京都",
    status: "researching" as const,
    photoUrls: [],
    costMin: 3000000,
    costMax: 4000000,
    capacityMin: 60,
    capacityMax: 100,
    scores: [],
  };
}

function makeCoupleScore(
  overrides: Partial<CoupleVenueScore> = {},
): CoupleVenueScore {
  return {
    overall: 4.2,
    alignment: 82,
    alignmentBucket: "aligned",
    weather: "sun",
    byDimension: [],
    agreedDimensions: [],
    discussDimensions: [],
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("VenueCard — Release β B-2 weather badge", () => {
  it("does NOT render the badge when coupleScore is undefined (existing call sites unchanged)", () => {
    render(<VenueCard venue={makeVenue()} />);
    expect(screen.queryByLabelText(/二人の合意/)).not.toBeInTheDocument();
  });

  it("does NOT render the badge when coupleScore is null", () => {
    render(<VenueCard venue={makeVenue()} coupleScore={null} />);
    expect(screen.queryByLabelText(/二人の合意/)).not.toBeInTheDocument();
  });

  it("renders the badge with '晴れ' label + overall when weather=sun", () => {
    render(
      <VenueCard
        venue={makeVenue()}
        coupleScore={makeCoupleScore({ weather: "sun", overall: 4.2 })}
      />,
    );
    const badge = screen.getByLabelText("二人の合意 晴れ 総合 4.2");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain("4.2");
  });

  it("renders the badge with '晴れ間' label when weather=cloud-sun", () => {
    render(
      <VenueCard
        venue={makeVenue()}
        coupleScore={makeCoupleScore({
          weather: "cloud-sun",
          overall: 3.7,
          alignment: 70,
          alignmentBucket: "close",
        })}
      />,
    );
    expect(
      screen.getByLabelText("二人の合意 晴れ間 総合 3.7"),
    ).toBeInTheDocument();
  });

  it("renders the badge with '曇り' label when weather=cloud", () => {
    render(
      <VenueCard
        venue={makeVenue()}
        coupleScore={makeCoupleScore({
          weather: "cloud",
          overall: 2.5,
          alignment: 40,
          alignmentBucket: "discuss",
        })}
      />,
    );
    expect(
      screen.getByLabelText("二人の合意 曇り 総合 2.5"),
    ).toBeInTheDocument();
  });

  it("omits the numeric overall when CoupleVenueScore.overall is null but still renders the badge", () => {
    render(
      <VenueCard
        venue={makeVenue()}
        coupleScore={makeCoupleScore({
          weather: "cloud",
          overall: null,
        })}
      />,
    );
    const badge = screen.getByLabelText("二人の合意 曇り");
    expect(badge).toBeInTheDocument();
    // The number 4.2 / 3.7 / 2.5 must NOT appear in the badge contents
    expect(badge.textContent ?? "").not.toMatch(/\d\.\d/);
  });

  it("does not regress the existing avgScore ★ when coupleScore is also provided", () => {
    // Both signals coexist: the venue ★ from venue.scores stays, and
    // the couple badge is overlaid on the photo separately.
    const venue = {
      ...makeVenue(),
      scores: [
        { source: "user_rating", dimension: "cuisine", score: 4.0 },
        { source: "user_rating", dimension: "hospitality", score: 4.0 },
      ],
    };
    render(<VenueCard venue={venue} coupleScore={makeCoupleScore()} />);
    // ★ number rounds to "4.0" — stays present
    expect(screen.getByText("4.0")).toBeInTheDocument();
    // weather badge also present
    expect(screen.getByLabelText(/二人の合意 晴れ/)).toBeInTheDocument();
  });
});
