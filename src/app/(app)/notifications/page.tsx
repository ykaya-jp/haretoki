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
    <div className="space-y-8">
      <div>
        <Link
          href="/mypage"
          className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          マイページに戻る
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10.5px] tracking-[0.18em] uppercase text-muted-foreground">
              <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
              <span aria-hidden="true" className="mx-2 opacity-30">·</span>
              <span>Inbox</span>
            </p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-h1 font-extralight tracking-[-0.01em]">
              通知
            </h2>
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
          description="保存した条件に合う式場が見つかったり、ふたりに届くお知らせがあれば、こちらにそっと並びます。"
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
