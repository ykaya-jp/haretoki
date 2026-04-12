"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { formatYen } from "@/lib/utils";
import { useSyncExternalStore } from "react";

const CATEGORY_LABELS: Record<string, string> = {
  attire: "衣裳",
  cuisine: "料理",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響・映像設備",
  venue_fee: "会場費",
  other: "その他",
};

type EstimateItem = {
  category: string;
  itemName: string;
  amount: number;
  predictedUpgrade: number | null;
};

type WaterfallData = {
  name: string;
  invisible: number;
  value: number;
  total: number;
  isTotal?: boolean;
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

function buildWaterfallData(
  initialTotal: number,
  predictedFinal: number,
  items: EstimateItem[]
): WaterfallData[] {
  const data: WaterfallData[] = [];

  // First bar: initial total
  data.push({
    name: "初期見積もり",
    invisible: 0,
    value: initialTotal,
    total: initialTotal,
    isTotal: true,
  });

  // Middle bars: category upgrades (aggregate by category)
  const categoryUpgrades = new Map<string, number>();
  for (const item of items) {
    if (item.predictedUpgrade && item.predictedUpgrade > 0) {
      const current = categoryUpgrades.get(item.category) ?? 0;
      categoryUpgrades.set(item.category, current + item.predictedUpgrade);
    }
  }

  // If no per-item upgrades, calculate overall difference
  if (categoryUpgrades.size === 0 && predictedFinal > initialTotal) {
    const diff = predictedFinal - initialTotal;
    data.push({
      name: "調整額",
      invisible: initialTotal,
      value: diff,
      total: predictedFinal,
    });
  } else {
    let runningTotal = initialTotal;
    for (const [category, upgrade] of categoryUpgrades) {
      data.push({
        name: CATEGORY_LABELS[category] ?? category,
        invisible: runningTotal,
        value: upgrade,
        total: runningTotal + upgrade,
      });
      runningTotal += upgrade;
    }
  }

  // Last bar: predicted final total
  data.push({
    name: "最終予測額",
    invisible: 0,
    value: predictedFinal,
    total: predictedFinal,
    isTotal: true,
  });

  return data;
}

// Custom label renderer for bar values
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderBarLabel(props: any) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const value = props.value as number | undefined;
  if (!value || value === 0) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="#374151"
      textAnchor="middle"
      fontSize={11}
      fontWeight={500}
    >
      {formatYen(value)}
    </text>
  );
}

export function EstimateWaterfallChart({
  initialTotal,
  predictedFinal,
  items,
}: {
  initialTotal: number;
  predictedFinal: number;
  items: EstimateItem[];
}) {
  const isMobile = useSyncExternalStore(
    subscribeToMediaQuery,
    getIsMobile,
    getIsMobileServer
  );

  const data = buildWaterfallData(initialTotal, predictedFinal, items);
  const chartHeight = isMobile ? 250 : 350;

  // Colors
  const COLOR_PRIMARY = "#1E3A8A";
  const COLOR_ACCENT = "#A16207";
  const COLOR_FINAL = "#7C3AED";

  function getBarColor(entry: WaterfallData): string {
    if (entry.name === "最終予測額") return COLOR_FINAL;
    if (entry.isTotal) return COLOR_PRIMARY;
    return COLOR_ACCENT;
  }

  return (
    <div className="space-y-3">
      <div className="w-full">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            margin={{
              top: 24,
              right: isMobile ? 8 : 16,
              left: isMobile ? 0 : 8,
              bottom: 4,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: isMobile ? 10 : 12, fill: "#64748B" }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={isMobile ? -20 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 50 : 30}
            />
            <YAxis
              tickFormatter={(v: number) => formatYen(v)}
              tick={{ fontSize: isMobile ? 9 : 11, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              width={isMobile ? 50 : 60}
            />
            {/* Invisible spacer bar */}
            <Bar dataKey="invisible" stackId="waterfall" fill="transparent" />
            {/* Visible value bar */}
            <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
              ))}
              <LabelList
                dataKey="total"
                content={renderBarLabel}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        他のカップルも同程度の調整をしています。事前に把握しておくことが大切です。
      </p>
    </div>
  );
}
