"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    setIsPending(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      setIsPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/5 active:scale-[0.98] disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "ログアウトしています..." : "ログアウト"}
    </button>
  );
}
