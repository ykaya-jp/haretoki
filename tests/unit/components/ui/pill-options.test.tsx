import { describe, it, expect, vi } from "vitest";
import { render, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PillOptions } from "@/components/ui/pill-options";

const OPTIONS = [
  { id: "a", label: "Option A" },
  { id: "b", label: "Option B" },
  { id: "c", label: "Option C" },
];

describe("PillOptions", () => {
  it("renders all options", () => {
    const { container } = render(
      <PillOptions options={OPTIONS} selected={[]} onToggle={() => {}} />
    );
    expect(within(container).getByText("Option A")).toBeInTheDocument();
    expect(within(container).getByText("Option B")).toBeInTheDocument();
    expect(within(container).getByText("Option C")).toBeInTheDocument();
    cleanup();
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { container } = render(
      <PillOptions options={OPTIONS} selected={[]} onToggle={onToggle} />
    );
    await user.click(within(container).getByText("Option B"));
    expect(onToggle).toHaveBeenCalledWith("b");
    cleanup();
  });

  it("applies selected styling", () => {
    const { container } = render(
      <PillOptions options={OPTIONS} selected={["a"]} onToggle={() => {}} />
    );
    const button = within(container).getByText("Option A");
    expect(button.className).toContain("bg-primary");
    cleanup();
  });

  it("applies unselected styling", () => {
    const { container } = render(
      <PillOptions options={OPTIONS} selected={[]} onToggle={() => {}} />
    );
    const button = within(container).getByText("Option A");
    expect(button.className).toContain("bg-card");
    cleanup();
  });
});
