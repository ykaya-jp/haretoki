"use client";

import { useEffect, useState } from "react";

interface ProgressRingProps {
  progress: number; // 0-100
  completedSteps: number;
  totalSteps: number;
}

export function ProgressRing({ progress, completedSteps, totalSteps }: ProgressRingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedProgress / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-[600ms] ease-out"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{Math.round(animatedProgress)}%</span>
        </div>
      </div>
      <span className="text-xs font-normal text-muted-foreground">
        {completedSteps}/{totalSteps}完了
      </span>
    </div>
  );
}
