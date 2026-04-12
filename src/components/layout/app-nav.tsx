"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AppNav() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="bg-primary">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/dashboard" className="text-lg text-primary-foreground">
          VenueLens
        </Link>

        {/* Navigation links */}
        <div className="flex items-center gap-4">
          <Link
            href="/venues"
            className="hidden min-h-[44px] min-w-[44px] items-center justify-center text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground md:inline-flex"
          >
            式場探索
          </Link>
          <Link
            href="/compare"
            className="hidden min-h-[44px] min-w-[44px] items-center justify-center text-sm text-primary-foreground/80 transition-colors hover:text-primary-foreground md:inline-flex"
          >
            比較
          </Link>
          <button
            onClick={handleSignOut}
            className="min-h-[44px] min-w-[44px] rounded-md px-3 py-1.5 text-sm text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            ログアウト
          </button>
        </div>
      </nav>
    </header>
  );
}
