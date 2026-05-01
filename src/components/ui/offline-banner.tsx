"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    // Sticky (not fixed) so the banner participates in flow and pushes
    // content down instead of occluding the first ~36px of the page.
    // W21-4: pt combines the original 8px (py-2) with iOS safe-area-
    // inset-top so the banner background extends through the notch but
    // the icon + copy still sit below it on standalone-PWA viewports.
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-40 bg-[var(--gold-warm)] px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-center text-sm font-medium text-white"
    >
      <WifiOff className="mr-2 inline-block h-4 w-4" />
      インターネット接続がありません
    </div>
  );
}
