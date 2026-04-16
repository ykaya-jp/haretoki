import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/generated/prisma/client";

const STATUS_CONFIG: Record<VenueStatus, { label: string; className: string }> =
  {
    researching: { label: "調査中", className: "bg-slate-100/90 text-slate-600" },
    visit_scheduled: {
      label: "見学予定",
      className: "bg-amber-50/90 text-amber-800",
    },
    visited: {
      label: "見学済み",
      className: "bg-[color-mix(in_oklab,var(--primary)_10%,var(--background))] text-[color-mix(in_oklab,var(--primary)_80%,var(--foreground))]",
    },
    shortlisted: {
      label: "候補",
      className: "bg-[color-mix(in_oklab,var(--success,#22c55e)_12%,var(--background))] text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]",
    },
    selected: {
      label: "決定",
      className: "bg-primary text-primary-foreground",
    },
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
