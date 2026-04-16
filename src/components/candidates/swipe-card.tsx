"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { Heart, X } from "lucide-react";
import { PhotoCarousel } from "@/components/venues/photo-carousel";
import { CircularProgressScore } from "@/components/comparison/circular-score";

interface SwipeCardProps {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    totalScore: number;
    topStrengths: string[];
    latestEstimate: { total: number } | null;
  };
  onSwipe: (direction: "left" | "right" | "up") => void;
  isTop: boolean;
}

const SWIPE_THRESHOLD = 100;

export function SwipeCard({ venue, onSwipe, isTop }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const leftOpacity = useTransform(x, [-150, 0], [0.5, 0]);
  const rightOpacity = useTransform(x, [0, 150], [0, 0.5]);

  return (
    <motion.div
      style={{ x, y, rotate, position: isTop ? "relative" : "absolute", zIndex: isTop ? 1 : 0 }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        const { offset } = info;
        if (offset.x > SWIPE_THRESHOLD) onSwipe("right");
        else if (offset.x < -SWIPE_THRESHOLD) onSwipe("left");
        else if (offset.y < -SWIPE_THRESHOLD) onSwipe("up");
      }}
      className="w-full overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]"
    >
      {/* Overlays */}
      <motion.div style={{ opacity: rightOpacity }} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-green-500/20">
        <Heart className="h-16 w-16 text-green-500" />
      </motion.div>
      <motion.div style={{ opacity: leftOpacity }} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-destructive/20">
        <X className="h-16 w-16 text-destructive" />
      </motion.div>

      <PhotoCarousel photos={venue.photoUrls} alt={venue.name} aspectRatio="4/3" />

      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-medium">{venue.name}</h3>
          <CircularProgressScore score={venue.totalScore} size={64} />
        </div>
        {venue.location && <p className="text-sm text-muted-foreground">{venue.location}</p>}
        <div className="flex flex-wrap gap-1">
          {venue.topStrengths.map(s => (
            <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}◎</span>
          ))}
        </div>
        {venue.latestEstimate && (
          <p className="tabular-nums text-sm text-[var(--gold-warm)]">
            ¥{(venue.latestEstimate.total / 10000).toFixed(0)}万〜
          </p>
        )}
      </div>
    </motion.div>
  );
}
