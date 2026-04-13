import { describe, it, expect } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { ProgressRing } from "@/components/ui/progress-ring";

describe("ProgressRing", () => {
  it("renders percentage text", () => {
    const { container } = render(
      <ProgressRing progress={60} completedSteps={3} totalSteps={5} />
    );
    // Initially renders 0% (before animation), check for the text
    expect(within(container).getByText("0%")).toBeInTheDocument();
    cleanup();
  });

  it("renders completed steps count", () => {
    const { container } = render(
      <ProgressRing progress={60} completedSteps={3} totalSteps={5} />
    );
    expect(within(container).getByText("3/5完了")).toBeInTheDocument();
    cleanup();
  });

  it("renders SVG circles", () => {
    const { container } = render(
      <ProgressRing progress={60} completedSteps={3} totalSteps={5} />
    );
    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(2); // background + progress
    cleanup();
  });
});
