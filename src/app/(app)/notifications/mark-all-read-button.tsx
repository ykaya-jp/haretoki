"use client";

import { useTransition } from "react";
import { markAllNotificationsRead } from "@/server/actions/notifications";
import { toast } from "sonner";

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.count > 0) {
        toast.success(`${result.count}件を既読にしました`);
      } else {
        toast("すでにすべて既読です");
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl text-sm text-[var(--gold-warm)] border border-[var(--gold-subtle)] bg-[var(--gold-subtle)]/30 transition-all duration-200 hover:bg-[var(--gold-subtle)]/60 active:scale-[0.98] disabled:opacity-50"
    >
      {isPending ? "処理中…" : "すべて既読にする"}
    </button>
  );
}
