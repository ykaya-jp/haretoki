"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

// Demo-only bottom nav. Mirrors the shape/feel of the real BottomNav but:
//  - Has 4 tabs (no マイページ — auth-only),
//  - Links stay inside /demo/*,
//  - No Server Components / badges / transitions tied to real data.

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/demo", label: "ホーム", icon: Home },
  { href: "/demo/venues", label: "探す", icon: Search },
  { href: "/demo/candidates", label: "候補", icon: Heart },
  { href: "/demo/coach", label: "コーチ", icon: MessageSquare },
];

function matchesHref(pathname: string, href: string): boolean {
  // /demo must match exactly (not prefix) so /demo/venues/... doesn't highlight home.
  return href === "/demo" ? pathname === "/demo" : pathname.startsWith(href);
}

export function DemoBottomNav() {
  const pathname = usePathname();
  const itemCount = NAV_ITEMS.length;
  const activeIndex = NAV_ITEMS.findIndex((item) => matchesHref(pathname, item.href));
  const tabWidthPct = 100 / itemCount;
  const indicatorWidthPct = tabWidthPct * 0.5;
  const indicatorLeftPct =
    activeIndex >= 0 ? tabWidthPct * activeIndex + tabWidthPct * 0.25 : 0;

  return (
    <nav
      role="navigation"
      aria-label="メインナビゲーション (デモ)"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative flex h-14 items-center justify-around">
        {activeIndex >= 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 h-0.5 rounded-full bg-primary transition-[left,width] duration-300 ease-out"
            style={{
              left: `${indicatorLeftPct}%`,
              width: `${indicatorWidthPct}%`,
            }}
          />
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = matchesHref(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1",
                "min-h-[48px] rounded-lg transition-colors duration-200 active:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span
                className={cn(
                  "text-xs whitespace-nowrap transition-colors duration-200",
                  isActive && "font-medium",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
