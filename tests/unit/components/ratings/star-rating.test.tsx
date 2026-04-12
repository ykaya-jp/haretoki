import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StarRating } from "@/components/ratings/star-rating";

describe("StarRating", () => {
  it("renders 5 stars", () => {
    render(<StarRating value={0} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    cleanup();
  });

  it("highlights filled stars based on value", () => {
    const { container } = render(<StarRating value={3} />);
    const buttons = within(container).getAllByRole("button");

    // First 3 stars should be pressed
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");

    // Last 2 stars should not be pressed
    expect(buttons[3]).toHaveAttribute("aria-pressed", "false");
    expect(buttons[4]).toHaveAttribute("aria-pressed", "false");
    cleanup();
  });

  it("calls onChange with clicked star value", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const { container } = render(
      <StarRating value={0} onChange={handleChange} />,
    );

    const buttons = within(container).getAllByRole("button");
    await user.click(buttons[3]); // 4th star (index 3)

    expect(handleChange).toHaveBeenCalledWith(4);
    cleanup();
  });
});
