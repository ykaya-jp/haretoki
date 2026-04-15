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
            <h2 className="font-[family-name:var(--font-display)] text-h1 font-extralight">
              通知
            </h2>
            <p className="mt-1 text-meta text-muted-foreground">
              新着のお知らせをここで確認できます
            </p>
          </div>
          {hasUnread && <MarkAllReadButton />}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="まだ通知はありません"
          description="式場の新着情報や保存した検索条件のマッチなど、お知らせが届いたらここに表示されます。"
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
