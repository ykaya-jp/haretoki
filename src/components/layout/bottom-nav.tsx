"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Search, Heart, MessageSquare, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  badgeKey?: "candidates" | "coach";
}

const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "ホーム", icon: Home },
  { href: "/explore", label: "探す", icon: Search },
  { href: "/candidates", label: "候補", icon: Heart, badgeKey: "candidates" },
  { href: "/coach", label: "コーチ", icon: MessageSquare, badgeKey: "coach" },
  { href: "/mypage", label: "マイページ", icon: UserCircle2 },
];

interface BottomNavProps {
  badges?: {
    candidates?: number;
    coach?: number;
  };
}

function matchesHref(pathname: string, href: string): boolean {
  return href === "/home" ? pathname === "/home" : pathname.startsWith(href);
}

export function BottomNav({ badges }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Eagerly prefetch all tabs after mount so taps on any tab feel instant.
  // /home, /explore, /candidates already get link-level prefetch (undefined =
  // default). /coach and /mypage are prefetch=false on the Link to save bandwidth
  // on initial load — but we warm them 200 ms after mount when the browser is
  // likely idle.
  useEffect(() => {
    const timer = setTimeout(() => {
      router.prefetch("/coach");
      router.prefetch("/mypage");
    }, 200);
    return () => clearTimeout(timer);
  }, [router]);

  // Optimistic active href — set on tap so the gold highlight moves instantly
  // AND loading.tsx can show immediately (we let <Link> do the navigation
  // itself; no startTransition wrapper, which would keep the old page visible).
  // No effect needed to clear pendingHref: `showPending` derivation below
  // flips to false the moment pathname matches, so the highlight falls back
  // to pathname-driven. Persistent pendingHref state is harmless.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const showPending =
    pendingHref !== null && !matchesHref(pathname, pendingHref);
  const activeHref = showPending ? pendingHref : pathname;

  // Indicator position as a single absolutely-positioned bar whose left/width
  // animate via CSS transition. Replaces framer-motion layoutId FLIP animation
  // to avoid layout thrash on tab transitions.
  const itemCount = NAV_ITEMS.length;
  const activeIndex = NAV_ITEMS.findIndex((item) =>
    matchesHref(activeHref, item.href),
  );
  const tabWidthPct = 100 / itemCount;
  // Bar spans middle half of its tab (matches prior left-1/4 / right-1/4).
  const indicatorWidthPct = tabWidthPct * 0.5;
  const indicatorLeftPct =
    activeIndex >= 0 ? tabWidthPct * activeIndex + tabWidthPct * 0.25 : 0;

  return (
    <nav
      role="navigation"
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/70 backdrop-blur-xl supports-[backdrop-filter]:bg-card/55 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative flex h-14 items-center justify-around">
        {activeIndex >= 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--gold-warm)] to-transparent transition-[left,width] duration-300 ease-out"
            style={{
              left: `${indicatorLeftPct}%`,
              width: `${indicatorWidthPct}%`,
            }}
          />
        )}
        {NAV_ITEMS.map((item) => {
          const isActive = matchesHref(activeHref, item.href);
          const Icon = item.icon;
          const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined;
          // Prefetch only the top-3 high-frequency tabs. Less-visited tabs
          // (/coach, /mypage) are fetched on tap to save bandwidth + memory.
          const shouldPrefetch =
            item.href === "/home" ||
            item.href === "/explore" ||
            item.href === "/candidates";

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={shouldPrefetch ? undefined : false}
              aria-current={isActive ? "page" : undefined}
              onClick={(e) => {
                if (
                  e.defaultPrevented ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey ||
                  e.button !== 0
                ) {
                  return;
                }
                if (matchesHref(pathname, item.href)) return;
                setPendingHref(item.href);
              }}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1",
                "min-h-[48px] rounded-lg transition-colors duration-200 active:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive ? "text-[var(--gold-warm)]" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    "transition-transform duration-200 ease-out",
                    isActive ? "scale-[1.12]" : "scale-100"
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                {badgeCount != null && badgeCount > 0 && (
                  <span
                    className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] animate-in zoom-in-50 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground duration-200"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </div>
              <span className={cn("text-xs whitespace-nowrap transition-colors duration-200", isActive && "font-medium")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
