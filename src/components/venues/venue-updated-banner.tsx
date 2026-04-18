"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

/**
 * Shown above the fold when the user lands here via the merged-import flow:
 * `/venues/{id}?updated=1`. Signals "新しい情報が足されました" with a gentle
 * pulse, then auto-scrubs the query param after a couple seconds so a
 * reload / share doesn't re-trigger the state.
 */
export function VenueUpdatedBanner() {
  const router = useRouter();
  const search = useSearchParams();
  const hasUpdated = search.get("updated") === "1";
  const [visible, setVisible] = useState(hasUpdated);

  useEffect(() => {
    if (!hasUpdated) return;
    const hideTimer = setTimeout(() => setVisible(false), 5000);
    const scrubTimer = setTimeout(() => {
      const params = new URLSearchParams(Array.from(search.entries()));
      params.delete("updated");
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    }, 2000);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(scrubTimer);
    };
  }, [hasUpdated, router, search]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mx-4 mt-2 mb-0 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 shadow-sm"
        >
          <div className="flex items-start gap-2">
            <div className="mt-0.5 shrink-0">
              <Sparkles
                className="h-4 w-4 text-primary animate-pulse"
                strokeWidth={2}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground leading-tight">
                新しい情報が追加されました
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground leading-relaxed">
                別サイトから見つかった情報をこの式場にまとめています。
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
