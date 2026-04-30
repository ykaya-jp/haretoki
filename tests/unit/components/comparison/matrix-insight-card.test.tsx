/**
 * Unit tests for MatrixInsightCard (CMP-5).
 *
 * Three cases:
 *   1. null insight → renders nothing
 *   2. AI-generated insight → summary + nextActions rendered
 *   3. Fallback (template) insight → same rendering path, fallback flag has no visual effect
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MatrixInsightCard } from "@/components/comparison/matrix-insight-card";
import type { MatrixInsight } from "@/server/actions/matrix-insight";

// PrefetchLink uses useRouter internally; stub it out for unit tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: vi.fn() }),
}));

const AI_INSIGHT: MatrixInsight = {
  summary: "総合では式場Aが頭ひとつ抜けています。",
  nextActions: ["費用差の内訳を見積もりで確認する", "見学日程を調整する"],
  fallback: false,
};

const FALLBACK_INSIGHT: MatrixInsight = {
  summary: "3 件のスコアはほぼ互角です。決め手を 1 つ仮置きすると差が見えてきます。",
  nextActions: ["外せない観点を 1 つだけ仮置きして、もう一度並べ替えてみる"],
  fallback: true,
};

describe("MatrixInsightCard", () => {
  afterEach(cleanup);

  it("renders nothing when insight is null", () => {
    const { container } = render(<MatrixInsightCard insight={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders summary and nextActions for AI insight", () => {
    render(<MatrixInsightCard insight={AI_INSIGHT} />);

    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(
      screen.getByText("AIコーチからのひとこと"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("総合では式場Aが頭ひとつ抜けています。"),
    ).toBeInTheDocument();
    // Both nextActions are rendered as links to /coach
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("費用差の内訳を見積もりで確認する");
    expect(links[1]).toHaveTextContent("見学日程を調整する");
    expect(links[0]).toHaveAttribute("href", "/coach");
  });

  it("renders summary and nextActions for fallback (template) insight", () => {
    render(<MatrixInsightCard insight={FALLBACK_INSIGHT} />);

    expect(screen.getByRole("article")).toBeInTheDocument();
    expect(
      screen.getByText(
        "3 件のスコアはほぼ互角です。決め手を 1 つ仮置きすると差が見えてきます。",
      ),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent(
      "外せない観点を 1 つだけ仮置きして、もう一度並べ替えてみる",
    );
  });
});
