"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  meta?: string;
  badge?: ReactNode;
  href: string;
  /** "accent" = gold-warm icon; "default" = muted icon */
  tone?: "default" | "accent";
}

/** Unified list row for mypage navigation items (SettingsRow pattern). */
export function SettingsRow({
  icon: Icon,
  label,
  meta,
  badge,
  href,
  tone = "default",
}: SettingsRowProps) {
  return (
    <Link
      href={href}
      prefetch
      className="group grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3.5 transition-colors active:bg-muted/40"
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "h-5 w-5 shrink-0",
          tone === "accent"
            ? "text-[var(--gold-warm)]"
            : "text-muted-foreground"
        )}
        strokeWidth={1.6}
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-medium leading-tight">
          {label}
        </span>
        {meta && (
          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
            {meta}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        {badge}
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.6}
        />
      </span>
    </Link>
  );
}
