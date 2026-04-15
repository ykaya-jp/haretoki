"use client";

import dynamic from "next/dynamic";

// Lazy-load the recharts-backed implementation to keep it out of the initial
// bundle. The chart is only needed when a venue has estimate data, and even
// then it sits below the fold on /venues/[id].
export const EstimateWaterfallChart = dynamic(
  () =>
    import("./estimate-waterfall-chart-impl").then(
      (m) => m.EstimateWaterfallChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="h-[250px] w-full animate-pulse rounded-xl bg-muted md:h-[350px]"
      />
    ),
  },
);
