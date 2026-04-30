"use client";

import { useEffect, useState } from "react";

interface DecisionProgressRingProps {
  completed: number;
  total: number;
}

/**
 * Gold arc 進捗リング。既存 `ProgressRing` とは別物として用意している
 * （数値表示「3/15」形式、gold 配色、Dark mode 対応を盛り込むため）。
 */
export function DecisionProgressRing({
  completed,
  total,
}: DecisionProgressRingProps) {
  const progress = total === 0 ? 0 : (completed / total) * 100;
  const [animated, setAnimated] = useState(0);
  const size = 96;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  useEffect(() => {
    const t = setTimeout(() => setAnimated(progress), 80);
    return () => clearTimeout(t);
  }, [progress]);

  return (
    <div
      className="relative inline-flex flex-col items-center"
      role="progressbar"
      aria-valuenow={completed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${total} 件中 ${completed} 件完了`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--gold-warm)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-[600ms] ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-[22px] font-light tabular-nums leading-none">
            {completed}
            <span className="text-[12px] text-muted-foreground">
              /{total}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
