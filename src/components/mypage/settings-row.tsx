import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  /** lucide-react icon shown on the left. Stroke width is fixed (1.75) so
   *  every row's icon weight matches across tones. */
  icon: LucideIcon;
  label: string;
  /** Secondary line under the label. Kept short — full sentences belong on
   *  the destination page, not in a list row. */
  meta?: string;
  /** Optional trailing element shown before the chevron — typically an
   *  unread count badge or a status pill. */
  badge?: React.ReactNode;
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
 * Layout contract: 44px minimum tap target, fixed `gap-3`, label/meta
 * column flex-1 so it truncates gracefully on long meta strings, chevron
 * always pinned to the right.
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
      className="flex min-h-[44px] items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          tone === "accent"
            ? "text-[var(--gold-warm)]"
            : "text-muted-foreground",
        )}
        strokeWidth={1.75}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium leading-tight">{label}</p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs leading-relaxed text-muted-foreground">
            {meta}
          </p>
        ) : null}
      </div>
      {badge ? <span className="shrink-0">{badge}</span> : null}
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/60"
        aria-hidden
      />
    </Link>
  );
}
