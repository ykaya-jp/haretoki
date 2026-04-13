"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFavorite } from "@/server/actions/favorites";
import { toast } from "sonner";

interface HeartButtonProps {
  venueId: string;
  initialFavorite: boolean;
}

export function HeartButton({ venueId, initialFavorite }: HeartButtonProps) {
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(initialFavorite);
  const [, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      setOptimisticFavorite(!optimisticFavorite);

      try {
        await toggleFavorite(venueId);
      } catch {
        toast.error("保存に失敗しました", {
          action: { label: "リトライ", onClick: handleToggle },
        });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={optimisticFavorite ? "候補から外す" : "候補に追加"}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 transition-transform active:scale-110"
    >
      <Heart
        className={cn(
          "h-5 w-5 transition-colors duration-200",
          optimisticFavorite ? "fill-[#FF385C] text-[#FF385C]" : "text-white"
        )}
      />
    </button>
  );
}
