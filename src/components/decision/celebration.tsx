"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface CelebrationProps {
  venueName: string;
  rationale: string | null;
  decidedAt: Date;
}

export function Celebration({ venueName, rationale, decidedAt }: CelebrationProps) {
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    // Dynamic import to avoid SSR issues
    import("canvas-confetti").then((confettiModule) => {
      const confetti = confettiModule.default;
      // Gold + navy confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#C9A84C", "#E8C97A", "#1E3A8A", "#3B82F6", "#FFFFFF"],
      });
    });
  }, []);

  const formattedDate = new Date(decidedAt).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      {/* Main celebration card */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#C9A84C]/60 via-transparent to-[#C9A84C]/60 p-[1px]">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-blue-900 p-8 text-center text-white md:p-12">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm uppercase tracking-[0.3em] text-[#E8C97A]"
          >
            Congratulations
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-3xl font-light tracking-[0.15em] text-white md:text-4xl"
          >
            おめでとうございます
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6"
          >
            <p className="text-sm tracking-wider text-blue-200">
              おふたりの特別な場所
            </p>
            <p className="mt-2 text-2xl tracking-[0.1em] text-white md:text-3xl">
              {venueName}
            </p>
          </motion.div>

          {rationale && (
            <motion.blockquote
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="mx-auto mt-8 max-w-md border-l-2 border-[#C9A84C]/50 pl-4 text-left text-sm italic text-blue-200"
            >
              {rationale}
            </motion.blockquote>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="mt-8 text-xs text-blue-300"
          >
            {formattedDate} に決定
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            className="mt-6 text-sm tracking-[0.2em] text-[#E8C97A]"
          >
            素敵な一日になりますように
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
