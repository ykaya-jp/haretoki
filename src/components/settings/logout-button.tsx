"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { logout } from "@/server/actions/auth";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      try {
        // Server Action: cleans Supabase cookies on the server AND calls
        // redirect("/login") in one trip. Using the server path avoids the
        // cookie/middleware race that the client-only signOut had.
        await logout();
      } catch (error) {
        // redirect() throws a NEXT_REDIRECT sentinel by design — let it
        // bubble so Next can complete the navigation.
        if (
          error &&
          typeof error === "object" &&
          "digest" in error &&
          typeof (error as { digest?: unknown }).digest === "string" &&
          (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw error;
        }
        toast.error("ログアウトできませんでした。もう一度お試しください");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      aria-busy={isPending}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/5 active:scale-[0.98] disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "ログアウトしています..." : "ログアウト"}
    </button>
  );
}
