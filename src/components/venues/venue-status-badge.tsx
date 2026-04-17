import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/generated/prisma/client";

/** Maps DB status → 3-stage display label + color */
const STATUS_CONFIG: Record<VenueStatus, { label: string; className: string }> =
  {
    // Stage 1: 気になる (interested)
    researching: {
      label: "気になる",
      className:
        "bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))]",
    },
    visit_scheduled: {
      label: "気になる",
      className:
        "bg-[color-mix(in_oklab,var(--gold-warm)_12%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))]",
    },
    // Stage 2: 検討中 (considering)
    visited: {
      label: "検討中",
      className:
        "bg-[color-mix(in_oklab,#3b82f6_10%,var(--background))] text-[color-mix(in_oklab,#3b82f6_75%,var(--foreground))]",
    },
    shortlisted: {
      label: "検討中",
      className:
        "bg-[color-mix(in_oklab,#3b82f6_10%,var(--background))] text-[color-mix(in_oklab,#3b82f6_75%,var(--foreground))]",
    },
    // Stage 3: 決定 (decided)
    selected: {
      label: "決定",
      className:
        "bg-[color-mix(in_oklab,var(--gold-warm)_20%,var(--background))] text-[color-mix(in_oklab,var(--gold-warm)_90%,var(--foreground))] ring-1 ring-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)]",
    },
    // 見送り — kept as-is, muted
    rejected: {
      label: "見送り",
      className: "bg-destructive/10 text-destructive",
    },
  };

export function VenueStatusBadge({ status }: { status: VenueStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
