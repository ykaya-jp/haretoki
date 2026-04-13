"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-0 right-0 top-0 z-[60] bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white"
    >
      <WifiOff className="mr-2 inline-block h-4 w-4" />
      インターネット接続がありません
    </div>
  );
}
