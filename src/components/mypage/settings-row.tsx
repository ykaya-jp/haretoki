import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Intentionally a Server Component: all animations are CSS-only
// (`hover:`, `active:`, `group-hover:`), no state / effects / event
// handlers. Marking this `"use client"` triggers a Server→Client function
// serialization error when the page passes lucide-react icon components
// as the `icon` prop (Functions cannot be passed directly to Client
// Components — observed in prod 2026-04-30 on /mypage).

interface SettingsRowProps {
  /** lucide-react icon shown on the left. Stroke width is fixed (1.6) so
   *  every row's icon weight matches across tones. */
  icon: LucideIcon;
  label: string;
  /** Secondary line under the label. Kept short — full sentences belong on
   *  the destination page, not in a list row. */
  meta?: string;
  /** Optional trailing element shown before the chevron — typically an
   *  unread count badge or a status pill. */
  badge?: ReactNode;
  href: string;
  /** `accent` paints the icon with the brand gold so a row earns visual
   *  weight without changing layout (used for "core" rows like 重み付け
   *  /保存条件). `default` keeps the icon muted. */
  tone?: "default" | "accent";
}

/**
 * W19-1: editorial settings row. Used inside a single rounded card with
 * `divide-y` so a list of rows reads as one composed surface, not as
 * stacked individual cards. Replaces the previous mypage pattern where
 * every link was a separate `rounded-2xl bg-card p-5 shadow` block — the
 * audit (audit-sub-A4 P0-1) flagged that as "並べただけ" and asked for
 * Linear-style settings rhythm instead.
 *
 * Layout contract: 44px minimum tap target (`min-h-11`), fixed `gap-3`,
 * label/meta column auto-sized via grid so it truncates gracefully on
 * long meta strings, chevron always pinned to the right with a subtle
 * group-hover translate.
 */
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
      className="group grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/40 active:bg-muted/60"
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
          className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
          strokeWidth={1.6}
        />
      </span>
    </Link>
  );
}
