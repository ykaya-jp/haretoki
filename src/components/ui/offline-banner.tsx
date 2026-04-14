"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    // Sticky (not fixed) so the banner participates in flow and pushes
    // content down instead of occluding the first ~36px of the page.
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-40 bg-[var(--gold-warm)] px-4 py-2 text-center text-sm font-medium text-white"
    >
      <WifiOff className="mr-2 inline-block h-4 w-4" />
      インターネット接続がありません
    </div>
  );
}
