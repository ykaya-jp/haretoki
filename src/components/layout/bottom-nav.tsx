"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, MessageSquare } from "lucide-react";
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
];

interface BottomNavProps {
  badges?: {
    candidates?: number;
    coach?: number;
  };
}

export function BottomNav({ badges }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      role="navigation"
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/home"
              ? pathname === "/home"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const badgeCount = item.badgeKey ? badges?.[item.badgeKey] : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-w-[64px] flex-col items-center justify-center gap-0.5 px-3 py-1",
                "min-h-[48px] transition-colors active:bg-muted",
                isActive ? "text-[var(--gold-warm)]" : "text-muted-foreground"
              )}
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Icon className="h-5 w-5" />
                </motion.div>
                {badgeCount != null && badgeCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </motion.span>
                )}
              </div>
              <span className={cn("text-[10px] transition-colors", isActive && "font-medium")}>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute -top-px left-1/4 right-1/4 h-0.5 rounded-full bg-[var(--gold-warm)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
