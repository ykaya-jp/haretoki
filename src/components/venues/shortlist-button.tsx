"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { updateVenueStatus } from "@/server/actions/venues";
import { cn } from "@/lib/utils";

interface ShortlistButtonProps {
  venueId: string;
  isShortlisted: boolean;
}

export function ShortlistButton({
  venueId,
  isShortlisted: initialShortlisted,
}: ShortlistButtonProps) {
  const [isShortlisted, setIsShortlisted] = useState(initialShortlisted);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // Prevent navigation to venue detail
    e.preventDefault();
    e.stopPropagation();

    const newStatus = isShortlisted ? "researching" : "shortlisted";
    setIsShortlisted(!isShortlisted);

    startTransition(async () => {
      try {
        await updateVenueStatus(venueId, newStatus);
      } catch {
        // Revert on error
        setIsShortlisted(isShortlisted);
      }
    });
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      whileTap={{ scale: 1.3 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={cn(
        "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full",
        "transition-colors active:bg-muted",
      )}
      aria-label={isShortlisted ? "候補から外す" : "候補に追加"}
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors",
          isShortlisted
            ? "fill-red-500 text-red-500"
            : "fill-none text-muted-foreground",
        )}
      />
    </motion.button>
  );
}
