import { describe, it, expect, vi } from "vitest";
import { render, cleanup, within } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { BottomNav } from "@/components/layout/bottom-nav";
import { usePathname } from "next/navigation";

describe("BottomNav", () => {
  it("renders 4 navigation tabs", () => {
    const { container } = render(<BottomNav />);
    expect(within(container).getByText("ホーム")).toBeInTheDocument();
    expect(within(container).getByText("探す")).toBeInTheDocument();
    expect(within(container).getByText("候補")).toBeInTheDocument();
    expect(within(container).getByText("コーチ")).toBeInTheDocument();
    cleanup();
  });

  it("marks active tab with aria-current", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { container } = render(<BottomNav />);
    const homeLink = within(container).getByText("ホーム").closest("a");
    expect(homeLink).toHaveAttribute("aria-current", "page");
    cleanup();
  });

  it("does not mark inactive tabs", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { container } = render(<BottomNav />);
    const exploreLink = within(container).getByText("探す").closest("a");
    expect(exploreLink).not.toHaveAttribute("aria-current");
    cleanup();
  });

  it("updates active tab based on pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/explore");
    const { container } = render(<BottomNav />);
    const exploreLink = within(container).getByText("探す").closest("a");
    expect(exploreLink).toHaveAttribute("aria-current", "page");
    cleanup();
  });

  it("has navigation role and aria-label", () => {
    vi.mocked(usePathname).mockReturnValue("/");
    const { container } = render(<BottomNav />);
    const nav = within(container).getByRole("navigation");
    expect(nav).toHaveAttribute("aria-label", "メインナビゲーション");
    cleanup();
  });
});
