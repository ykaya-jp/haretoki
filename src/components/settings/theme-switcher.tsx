"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "light", icon: Sun, label: "ライト" },
  { id: "dark", icon: Moon, label: "ダーク" },
  { id: "system", icon: Monitor, label: "自動" },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // next-themes resolves the active theme only after client hydration, so we
  // defer the active-highlight class until mount to avoid SSR/client mismatch.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="flex gap-1 rounded-full bg-muted p-1">
      {THEMES.map(({ id, icon: Icon, label }) => {
        const isActive = mounted && theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={isActive}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm transition-colors",
              isActive ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
