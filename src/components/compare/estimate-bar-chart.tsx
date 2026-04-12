"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { formatYen } from "@/lib/utils";
import { useSyncExternalStore } from "react";

type VenueEstimateData = {
  name: string;
  initial: number | null;
  predicted: number | null;
};

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

// Custom tooltip for yen formatting
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border bg-card px-3 py-2 shadow-sm">
      <p className="text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-sm"
          style={{ color: entry.color }}
        >
          {entry.name}: {formatYen(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function EstimateBarChart({
  venues,
}: {
  venues: VenueEstimateData[];
}) {
  const isMobile = useSyncExternalStore(
    subscribeToMediaQuery,
    getIsMobile,
    getIsMobileServer
  );

  // Filter to venues with at least one estimate value
  const data = venues.filter((v) => v.initial !== null || v.predicted !== null);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        見積もりデータがありません
      </p>
    );
  }

  const chartHeight = Math.max(data.length * 60 + 40, 150);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 8,
            right: isMobile ? 8 : 24,
            left: isMobile ? 4 : 8,
            bottom: 8,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatYen(v)}
            tick={{ fontSize: isMobile ? 9 : 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: isMobile ? 10 : 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 60 : 80}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: isMobile ? 10 : 12 }}
          />
          <Bar
            dataKey="initial"
            name="初期見積もり"
            fill="#1E3A8A"
            radius={[0, 4, 4, 0]}
            barSize={isMobile ? 16 : 20}
          />
          <Bar
            dataKey="predicted"
            name="最終予測額"
            fill="#A16207"
            radius={[0, 4, 4, 0]}
            barSize={isMobile ? 16 : 20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
