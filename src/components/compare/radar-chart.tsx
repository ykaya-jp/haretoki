"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { useSyncExternalStore } from "react";

export type RadarChartData = {
  venueName: string;
  color: string;
  scores: Partial<Record<string, number>>;
};

const COLORS = ["#1E3A8A", "#3B82F6", "#A16207"];

function subscribeToMediaQuery(callback: () => void) {
  const mql = window.matchMedia("(min-width: 768px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsMobile() {
  return !window.matchMedia("(min-width: 768px)").matches;
}

function getIsMobileServer() {
  return true;
}

export function VenueRadarChart({ data }: { data: RadarChartData[] }) {
  const isMobile = useSyncExternalStore(
    subscribeToMediaQuery,
    getIsMobile,
    getIsMobileServer
  );

  if (data.length === 0) return null;

  // Transform data into recharts format
  const chartData = TIER1_DIMENSIONS.map((dim) => {
    const point: Record<string, string | number> = {
      dimension: DIMENSION_LABELS[dim] ?? dim,
    };
    data.forEach((venue, i) => {
      point[`venue${i}`] = venue.scores[dim] ?? 0;
    });
    return point;
  });

  const chartHeight = isMobile ? 220 : 300;
  const outerRadius = isMobile ? 60 : 90;
  const labelFontSize = isMobile ? 9 : 11;

  return (
    <div className="w-full overflow-x-auto">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius={outerRadius}>
          <PolarGrid stroke="#BFDBFE" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: labelFontSize, fill: "#64748B" }}
          />
          <PolarRadiusAxis domain={[0, 5]} tickCount={6} fontSize={9} />
          {data.map((venue, i) => (
            <Radar
              key={venue.venueName}
              name={venue.venueName}
              dataKey={`venue${i}`}
              stroke={venue.color || COLORS[i % COLORS.length]}
              fill={venue.color || COLORS[i % COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
          <Legend
            wrapperStyle={{ fontSize: isMobile ? 10 : 12 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
