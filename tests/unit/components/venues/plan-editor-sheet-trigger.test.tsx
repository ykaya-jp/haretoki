import { afterEach, describe, it, expect, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import React from "react";

/**
 * Regression test for the 2026-05-15 "印象を残す ボタンが反応しない" report.
 *
 * Root cause: `PlanEditorSheet` rendered `<SheetTrigger render={undefined}>
 * {trigger}</SheetTrigger>` when the caller supplied a `<button>` trigger.
 * base-ui's `Dialog.Trigger` falls back to its own default `<button>` when
 * `render` is undefined, so the caller's `<button>` ended up nested inside
 * base-ui's `<button>` — invalid HTML, hydration error
 * (`<button> cannot be a descendant of <button>`), which broke React's
 * event delegation across the entire `/venues/[id]` page. The Link to
 * `/impression` (and other client-side navigations) silently failed.
 *
 * Fix: pass the caller's trigger via `render={trigger ?? defaultTrigger}`
 * so base-ui composes it as the actual trigger element, no wrapping.
 *
 * This test pins the contract: PlanEditorSheet must render exactly ONE
 * `<button>` (not nested) at the trigger position, whether the caller
 * supplies a custom trigger or not.
 */

vi.mock("@/server/actions/plans", () => ({
  upsertVenuePlan: vi.fn(),
  deleteVenuePlan: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { PlanEditorSheet } from "@/components/venues/plan-editor-sheet";

afterEach(() => cleanup());

describe("PlanEditorSheet — trigger composition (no nested <button>)", () => {
  it("default trigger renders a single <button>, not nested", () => {
    render(<PlanEditorSheet venueId="v1" />);
    // Find every button that base-ui marks as the sheet trigger.
    const triggers = document.querySelectorAll<HTMLButtonElement>(
      '[data-slot="sheet-trigger"]',
    );
    expect(triggers.length).toBeGreaterThan(0);
    for (const t of triggers) {
      // The trigger itself must be the <button>. There must NOT be a
      // child <button> inside it (that would be the old nested-button
      // hydration error).
      expect(t.tagName).toBe("BUTTON");
      expect(t.querySelector("button")).toBeNull();
    }
  });

  it("custom trigger via prop renders without nesting", () => {
    render(
      <PlanEditorSheet
        venueId="v1"
        trigger={
          <button type="button" data-testid="custom-trigger">
            プランを記録する
          </button>
        }
      />,
    );
    const trigger = screen.getByTestId("custom-trigger");
    // The custom <button> must be the sheet trigger itself (composed via
    // render prop), so it carries base-ui's data-slot AND has no nested
    // <button> descendant.
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("data-slot")).toBe("sheet-trigger");
    expect(trigger.querySelector("button")).toBeNull();
    // And there should be exactly one trigger node total — no orphan
    // default trigger emitted alongside the custom one.
    const allTriggers = document.querySelectorAll('[data-slot="sheet-trigger"]');
    expect(allTriggers.length).toBe(1);
  });
});
