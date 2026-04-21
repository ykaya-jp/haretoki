import { describe, it, expect, vi } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import { AIInsightCard } from "@/components/ai/insight-card";

// PrefetchLink uses useRouter internally; stub it out for unit tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: vi.fn() }),
}));

describe("AIInsightCard", () => {
  it("renders title and body", () => {
    const { container } = render(
      <AIInsightCard
        type="estimate"
        title="見積もりアラート"
        body="料理が最低ランクです"
        actions={[]}
      />
    );
    expect(within(container).getByText("見積もりアラート")).toBeInTheDocument();
    expect(within(container).getByText("料理が最低ランクです")).toBeInTheDocument();
    cleanup();
  });

  it("renders action links", () => {
    const { container } = render(
      <AIInsightCard
        type="comparison"
        title="比較提案"
        body="比較してみましょう"
        actions={[{ label: "比べる", href: "/candidates" }]}
      />
    );
    const link = within(container).getByText("比べる");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/candidates");
    cleanup();
  });

  it("has article role with aria-label", () => {
    const { container } = render(
      <AIInsightCard
        type="visit"
        title="見学準備"
        body="チェックリストを確認"
        actions={[]}
      />
    );
    const article = within(container).getByRole("article");
    expect(article).toHaveAttribute("aria-label", "見学準備");
    cleanup();
  });

  it("renders without actions", () => {
    const { container } = render(
      <AIInsightCard
        type="reminder"
        title="リマインダー"
        body="評価を記録しましょう"
        actions={[]}
      />
    );
    expect(within(container).getByText("リマインダー")).toBeInTheDocument();
    cleanup();
  });
});
