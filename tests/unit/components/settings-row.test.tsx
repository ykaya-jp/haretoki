import { afterEach, describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Bookmark, Settings } from "lucide-react";
import { SettingsRow } from "@/components/mypage/settings-row";

/**
 * SettingsRow — aria / structure contract.
 * Uses render-scoped queries to avoid cross-test DOM leakage.
 */

afterEach(() => {
  cleanup();
});

describe("SettingsRow", () => {
  it("renders as a link with correct href", () => {
    const { getByRole } = render(
      <SettingsRow
        icon={Bookmark}
        label="保存した検索条件"
        href="/mypage/saved-searches"
      />
    );
    const link = getByRole("link", { name: /保存した検索条件/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/mypage/saved-searches");
  });

  it("renders label and meta text", () => {
    const { getByText } = render(
      <SettingsRow
        icon={Settings}
        label="設定A"
        meta="見た目・ログアウト"
        href="/settings"
      />
    );
    expect(getByText("設定A")).toBeInTheDocument();
    expect(getByText("見た目・ログアウト")).toBeInTheDocument();
  });

  it("renders badge when provided", () => {
    const { getByTestId } = render(
      <SettingsRow
        icon={Bookmark}
        label="通知B"
        href="/notifications"
        badge={<span data-testid="badge">3</span>}
      />
    );
    expect(getByTestId("badge")).toBeInTheDocument();
    expect(getByTestId("badge")).toHaveTextContent("3");
  });

  it("has min-h-11 (44px) touch target class", () => {
    const { getByRole } = render(
      <SettingsRow icon={Settings} label="設定C" href="/settings-c" />
    );
    const link = getByRole("link", { name: /設定C/ });
    expect(link.className).toMatch(/min-h-11/);
  });

  it("omits meta element when meta prop is absent", () => {
    const { queryByText } = render(
      <SettingsRow icon={Settings} label="設定のみD" href="/settings-d" />
    );
    // No meta prop — secondary text must not appear
    expect(queryByText("見た目・ログアウト")).toBeNull();
  });
});
