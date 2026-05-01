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
      // W21-5 (audit P2-9): replace /30 → /60 opacity ramp with
      // color-mix so the rest/hover diff stays readable in dark mode
      // (where /30 collapses against the page surface).
      className="min-h-11 inline-flex items-center px-4 py-2 rounded-xl text-sm text-[var(--gold-warm)] border border-[var(--gold-subtle)] bg-[color-mix(in_oklab,var(--gold-warm)_6%,var(--background))] transition-all duration-200 hover:bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))] active:scale-[0.98] disabled:opacity-50"
    >
      {isPending ? "処理中…" : "すべて既読にする"}
    </button>
  );
}
