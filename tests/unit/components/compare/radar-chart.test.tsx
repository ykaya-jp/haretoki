import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { VenueRadarChart } from "@/components/compare/radar-chart";
import type { RadarChartData } from "@/components/compare/radar-chart";

// Recharts ResponsiveContainer needs element dimensions in jsdom
class ResizeObserverMock {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    // Fire callback immediately with a mocked size
    this.callback(
      [{ contentRect: { width: 500, height: 300 } } as ResizeObserverEntry],
      this
    );
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock getBoundingClientRect so ResponsiveContainer detects dimensions
vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
  width: 500,
  height: 300,
  top: 0,
  left: 0,
  bottom: 300,
  right: 500,
  x: 0,
  y: 0,
  toJSON: () => {},
});

describe("VenueRadarChart", () => {
  it("renders with venue data", () => {
    const data: RadarChartData[] = [
      {
        venueName: "式場A",
        color: "#1E3A8A",
        scores: { atmosphere: 4.5, hospitality: 3.8, cuisine: 4.0 },
      },
      {
        venueName: "式場B",
        color: "#3B82F6",
        scores: { atmosphere: 3.5, hospitality: 4.2, cuisine: 3.0 },
      },
    ];

    const { container } = render(<VenueRadarChart data={data} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders nothing when data is empty", () => {
    const { container } = render(<VenueRadarChart data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
