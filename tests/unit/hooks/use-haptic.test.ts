import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHaptic } from "@/hooks/use-haptic";

// Cast to a writable shape so tests can swap navigator.vibrate without TS griping.
// `vibrate` is intentionally typed as a wider optional so that tests can simulate
// "Vibration API not present" by assigning undefined.
type MutableNavigator = Omit<Navigator, "vibrate"> & {
  vibrate?: ((pattern: number | number[]) => boolean) | undefined;
};

// jsdom does not implement matchMedia by default. Provide a baseline that
// returns matches=false (= no reduced-motion preference) so most tests pass
// through useHaptic's preference guard. Individual tests override this by
// assigning a different impl on `window.matchMedia` directly.
function makeMatchMedia(matchesFn: (query: string) => boolean) {
  return (query: string) =>
    ({
      matches: matchesFn(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

describe("useHaptic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default: no reduced-motion preference. Direct assignment because
    // jsdom often ships without matchMedia, so vi.spyOn would fail.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: makeMatchMedia(() => false),
    });
  });

  it("calls navigator.vibrate with the select pattern", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    (navigator as MutableNavigator).vibrate = vibrate;

    const { result } = renderHook(() => useHaptic());
    act(() => {
      result.current("select");
    });

    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it("calls navigator.vibrate with the success pattern", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    (navigator as MutableNavigator).vibrate = vibrate;

    const { result } = renderHook(() => useHaptic());
    act(() => {
      result.current("success");
    });

    expect(vibrate).toHaveBeenCalledWith([12, 60, 18]);
  });

  it("calls navigator.vibrate with the impact pattern", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    (navigator as MutableNavigator).vibrate = vibrate;

    const { result } = renderHook(() => useHaptic());
    act(() => {
      result.current("impact");
    });

    expect(vibrate).toHaveBeenCalledWith(25);
  });

  it("no-ops when navigator.vibrate is unavailable", () => {
    (navigator as MutableNavigator).vibrate = undefined;

    const { result } = renderHook(() => useHaptic());
    expect(() => {
      act(() => {
        result.current("select");
      });
    }).not.toThrow();
  });

  it("no-ops when prefers-reduced-motion: reduce", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    (navigator as MutableNavigator).vibrate = vibrate;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: makeMatchMedia((q) => q.includes("reduce")),
    });

    const { result } = renderHook(() => useHaptic());
    act(() => {
      result.current("success");
    });

    expect(vibrate).not.toHaveBeenCalled();
  });

  it("swallows errors thrown by navigator.vibrate (browser policy)", () => {
    const vibrate = vi.fn().mockImplementation(() => {
      throw new Error("denied");
    });
    (navigator as MutableNavigator).vibrate = vibrate;

    const { result } = renderHook(() => useHaptic());
    expect(() => {
      act(() => {
        result.current("impact");
      });
    }).not.toThrow();
    expect(vibrate).toHaveBeenCalled();
  });
});
