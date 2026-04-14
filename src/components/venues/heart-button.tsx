"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFavorite } from "@/server/actions/favorites";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface HeartButtonProps {
  venueId: string;
  initialFavorite: boolean;
}

export function HeartButton({ venueId, initialFavorite }: HeartButtonProps) {
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(initialFavorite);
  const [, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const newState = !optimisticFavorite;
      setOptimisticFavorite(newState);

      try {
        await toggleFavorite(venueId);
        toast.success(newState ? "お気に入りに追加しました" : "お気に入りから外しました", {
          duration: 2000,
        });
      } catch {
        toast.error("保存できませんでした", {
          action: { label: "もう一度", onClick: handleToggle },
        });
      }
    });
  };

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      aria-label={optimisticFavorite ? "お気に入りから外す" : "お気に入りに追加"}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm transition-colors hover:bg-white active:bg-white/60"
      whileTap={{ scale: 1.15 }}
      transition={{ type: "spring", stiffness: 200, damping: 12 }}
    >
      <motion.div
        key={optimisticFavorite ? "filled" : "empty"}
        initial={{ scale: 0.3 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 12 }}
      >
        <Heart
          className={cn(
            "h-5 w-5 transition-colors duration-200",
            optimisticFavorite ? "fill-[#FF385C] text-[#FF385C]" : "text-gray-600"
          )}
        />
      </motion.div>
    </motion.button>
  );
}
