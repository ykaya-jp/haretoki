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

export type RadarChartData = {
  venueName: string;
  color: string;
  scores: Partial<Record<string, number>>;
};

const COLORS = ["#1E3A8A", "#3B82F6", "#A16207"];

export function VenueRadarChart({ data }: { data: RadarChartData[] }) {
  if (data.length === 0) return null;

  // Transform data into recharts format:
  // Each item = { dimension: "雰囲気", venue1: 4.2, venue2: 3.5, ... }
  const chartData = TIER1_DIMENSIONS.map((dim) => {
    const point: Record<string, string | number> = {
      dimension: DIMENSION_LABELS[dim] ?? dim,
    };
    data.forEach((venue, i) => {
      point[`venue${i}`] = venue.scores[dim] ?? 0;
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={chartData}>
        <PolarGrid stroke="#BFDBFE" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: "#64748B" }}
        />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} />
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
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}
