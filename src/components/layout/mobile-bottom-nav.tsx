"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, BarChart3, Star, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ホーム", icon: Home },
  { href: "/venues", label: "式場", icon: Search },
  { href: "/compare", label: "比較", icon: BarChart3 },
  { href: "/shortlist", label: "候補", icon: Star },
  { href: "/decision", label: "決定", icon: CheckCircle },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 text-[10px] transition-colors active:bg-muted",
                isActive ? "text-primary" : "text-foreground-muted",
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
