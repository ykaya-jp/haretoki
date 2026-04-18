"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markNotificationRead } from "@/server/actions/notifications";
import type { NotificationRow } from "@/server/actions/notifications";

function relativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  const fmt = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return fmt.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return fmt.format(diffHr, "hour");
  if (Math.abs(diffDay) < 30) return fmt.format(diffDay, "day");
  return fmt.format(Math.round(diffDay / 30), "month");
}

function resolveHref(notification: NotificationRow): string {
  if (notification.href) return notification.href;
  if (notification.type === "saved_search_match") return "/mypage/saved-searches";
  return "/notifications";
}

interface NotificationItemProps {
  notification: NotificationRow;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      if (!notification.read) {
        await markNotificationRead(notification.id);
      }
      const href = resolveHref(notification);
      if (href !== "/notifications") {
        router.push(href);
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={[
        "w-full text-left rounded-2xl border p-4 transition-all duration-200",
        "min-h-[44px] active:scale-[0.98] disabled:opacity-50",
        notification.read
          ? "bg-card border-border/60"
          : "bg-[var(--gold-subtle)]/30 border-l-[3px] border-l-[var(--gold-warm)] border-border/60",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={[
            "font-[family-name:var(--font-display)] text-base leading-snug tracking-wide",
            notification.read ? "font-light" : "font-light",
          ].join(" ")}
        >
          {notification.title}
        </p>
        {!notification.read && (
          <span
            aria-label="未読"
            className="mt-1 shrink-0 h-2 w-2 rounded-full bg-[var(--gold-warm)]"
          />
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        {notification.body}
      </p>
      <p className="mt-2 text-xs text-muted-foreground/70 tabular-nums">
        {relativeTime(notification.createdAt)}
      </p>
    </button>
  );
}
