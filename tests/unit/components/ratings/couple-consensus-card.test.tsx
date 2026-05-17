import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { CoupleConsensusCard } from "@/components/ratings/couple-consensus-card";
import type { CoupleVenueScore } from "@/lib/scoring";

function makeScore(overrides: Partial<CoupleVenueScore> = {}): CoupleVenueScore {
  return {
    overall: 4.2,
    alignment: 80,
    alignmentBucket: "aligned",
    weather: "sun",
    byDimension: [
      { dimension: "cuisine", own: 4.1, partner: 4.3, avg: 4.2, aligned: true },
      {
        dimension: "hospitality",
        own: 4.0,
        partner: 4.5,
        avg: 4.25,
        aligned: true,
      },
    ],
    agreedDimensions: ["cuisine", "hospitality"],
    discussDimensions: ["banquet_space"],
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("CoupleConsensusCard — Release β B-1", () => {
  it("renders the weather label '晴れの日' when weather=sun", () => {
    render(<CoupleConsensusCard score={makeScore({ weather: "sun" })} />);
    expect(screen.getByLabelText("二人の合意")).toBeInTheDocument();
    expect(screen.getByText(/晴れの日/)).toBeInTheDocument();
  });

  it("renders the weather label '晴れ間' when weather=cloud-sun", () => {
    render(
      <CoupleConsensusCard
        score={makeScore({
          weather: "cloud-sun",
          alignment: 60,
          alignmentBucket: "close",
        })}
      />,
    );
    expect(screen.getByText(/晴れ間/)).toBeInTheDocument();
  });

  it("renders the weather label '曇り' and '—' for overall when weather=cloud + overall null", () => {
    render(
      <CoupleConsensusCard
        score={makeScore({
          weather: "cloud",
          overall: null,
          byDimension: [],
          agreedDimensions: [],
          discussDimensions: [],
        })}
      />,
    );
    expect(screen.getByText(/曇り/)).toBeInTheDocument();
    expect(screen.getByLabelText("総合スコア 未評価")).toBeInTheDocument();
  });

  it("formats overall to one decimal place with tabular-nums", () => {
    render(<CoupleConsensusCard score={makeScore({ overall: 4.25 })} />);
    // toFixed(1) rounds 4.25 → "4.3" (banker's rounding edge in JS,
    // but here the next digit is 5 → rounds up via toFixed)
    expect(screen.getByLabelText(/総合スコア 4\.3/)).toBeInTheDocument();
  });

  it("shows agreed-dimension and discuss-dimension counts", () => {
    render(
      <CoupleConsensusCard
        score={makeScore({
          agreedDimensions: ["cuisine", "hospitality", "ceremony_space"],
          discussDimensions: ["banquet_space"],
        })}
      />,
    );
    const agreed = screen.getByText("3");
    const discuss = screen.getByText("1");
    expect(agreed).toBeInTheDocument();
    expect(discuss).toBeInTheDocument();
  });

  it("uses the provided ownName / partnerName labels", () => {
    render(
      <CoupleConsensusCard
        score={makeScore()}
        ownName="夫"
        partnerName="妻"
      />,
    );
    expect(screen.getByText("夫")).toBeInTheDocument();
    expect(screen.getByText("妻")).toBeInTheDocument();
  });

  it("renders '—' on the partner side when partner has not rated any dimension", () => {
    render(
      <CoupleConsensusCard
        score={makeScore({
          byDimension: [
            {
              dimension: "cuisine",
              own: 4,
              partner: null,
              avg: 4,
              aligned: false,
            },
          ],
        })}
        ownName="あなた"
        partnerName="妻"
      />,
    );
    // partner row shows the dash; own row shows the numeric mean
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("flags the bar as '未評価' for sides without any rating", () => {
    render(
      <CoupleConsensusCard
        score={makeScore({
          byDimension: [
            {
              dimension: "cuisine",
              own: null,
              partner: 4,
              avg: 4,
              aligned: false,
            },
          ],
        })}
      />,
    );
    expect(screen.getByLabelText("未評価")).toBeInTheDocument();
  });

  it("renders the alignment badge with the provided alignment score", () => {
    render(
      <CoupleConsensusCard
        score={makeScore({ alignment: 92, alignmentBucket: "aligned" })}
      />,
    );
    // AlignmentBadge surfaces the bucket label
    expect(screen.getByLabelText(/ふたりの意見一致度 92/)).toBeInTheDocument();
  });
});
