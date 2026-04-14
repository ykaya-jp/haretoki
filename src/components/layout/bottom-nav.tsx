"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Home, Search, Heart, MessageSquare, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
  const [isPending, startTransition] = useTransition();
  // Optimistic active href — set on tap so the gold highlight moves instantly,
  // even while the Server Component for the target route is still resolving.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Derive active href: honor optimistic pendingHref only while a transition is
  // still in flight and the real pathname hasn't caught up yet. Otherwise fall
  // back to the real pathname so we always self-correct without effects.
  const showPending =
    pendingHref !== null &&
    isPending &&
    !matchesHref(pathname, pendingHref);
  const activeHref = showPending ? (pendingHref as string) : pathname;

  return (
    <nav
      role="navigation"
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/20 bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = matchesHref(activeHref, item.href);
          const Icon = item.icon;
          const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
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
                e.preventDefault();
                setPendingHref(item.href);
                startTransition(() => {
                  router.push(item.href);
                });
              }}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 px-1 py-1",
                "min-h-[48px] rounded-lg transition-colors duration-200 active:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: isActive ? 1.12 : 1 }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                >
                  <Icon className="h-5 w-5" />
                </motion.div>
                {badgeCount != null && badgeCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 120, damping: 18 }}
                    className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </motion.span>
                )}
              </div>
              <span className={cn("text-xs whitespace-nowrap transition-colors duration-200", isActive && "font-medium")}>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-px left-1/4 right-1/4 h-0.5 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
