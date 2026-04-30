import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "@/lib/venue-search/debounce";

/**
 * Debounce contract — see `src/lib/venue-search/debounce.ts`.
 *
 * Using vitest fake timers so tests are deterministic and don't spend
 * real wall-clock 300ms per assertion (×N = slow CI).
 */
describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire until delay elapses", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d("a");
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("coalesces rapid calls into the last args", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d("a");
    vi.advanceTimersByTime(100);
    d("b");
    vi.advanceTimersByTime(100);
    d("c");
    // Only 200ms elapsed since 'c' — nothing yet.
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("cancel() prevents pending invocation", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d("a");
    vi.advanceTimersByTime(200);
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  it("flush() runs pending invocation immediately", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d("a");
    d.flush();
    expect(fn).toHaveBeenCalledWith("a");
    // flushed — subsequent timer advance should not re-fire.
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush() with no pending is a no-op", () => {
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
