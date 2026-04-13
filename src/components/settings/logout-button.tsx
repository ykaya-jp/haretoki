"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/server/actions/auth";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/5 active:scale-[0.98] disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
