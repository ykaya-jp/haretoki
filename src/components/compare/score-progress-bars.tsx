"use client";

import { motion } from "framer-motion";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  getScoreColorHex,
} from "@/lib/constants";

interface ScoreBarData {
  venueName: string;
  color: string;
  scores: Record<string, number>;
}

export function ScoreProgressBars({ data }: { data: ScoreBarData[] }) {
  return (
    <div className="space-y-4">
      {TIER1_DIMENSIONS.map((dim) => (
        <div key={dim} className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {DIMENSION_LABELS[dim]}
            </span>
          </div>
          {data.map((venue) => {
            const score = venue.scores[dim] ?? 0;
            const percentage = (score / 5) * 100;
            return (
              <div key={venue.venueName} className="flex items-center gap-2">
                <span className="w-20 truncate text-xs text-muted-foreground">
                  {venue.venueName}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{
                      duration: 0.8,
                      ease: [0.16, 1, 0.3, 1],
                      delay: 0.1,
                    }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: score > 0 ? getScoreColorHex(score) : venue.color,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-medium tabular-nums">
                  {score > 0 ? score.toFixed(1) : "\u2014"}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
