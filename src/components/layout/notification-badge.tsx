"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { getUnreadCount } from "@/server/actions/notifications";

interface NotificationBadgeProps {
  /** Initial unread count from server — avoids flash of 0 on mount. */
  initialCount?: number;
}

export function NotificationBadge({ initialCount = 0 }: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    getUnreadCount()
      .then(setCount)
      .catch(() => {
        // Silently fail — badge is best-effort
      });
  }, []);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `通知 ${count}件の未読` : "通知"}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-muted active:bg-muted active:scale-[0.96]"
    >
      <Bell className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white tabular-nums"
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
