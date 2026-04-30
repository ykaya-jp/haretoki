import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bell } from "lucide-react";
import { listNotifications } from "@/server/actions/notifications";
import { NotificationItem } from "./notification-item";
import { MarkAllReadButton } from "./mark-all-read-button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "通知",
  description: "新着のお知らせを確認できます。",
};

export default async function NotificationsPage() {
  const notifications = await listNotifications(30);
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
              <Link
                href="/mypage"
                prefetch={false}
                className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </Link>
              <span aria-hidden="true" className="opacity-30">/</span>
              <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
              <span aria-hidden="true" className="opacity-30">·</span>
              <span>Inbox</span>
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-display)] text-h1 font-light tracking-[-0.01em]">
              通知
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              ふたりに届いたお知らせを、ここにまとめています。
            </p>
          </div>
          {hasUnread && <MarkAllReadButton />}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="いまは静かな一日です"
          description="残した条件に合う式場が見つかったり、ふたりに届くお知らせがあれば、こちらにそっと並びます。"
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
