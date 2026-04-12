import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/generated/prisma/client";

const STATUS_CONFIG: Record<VenueStatus, { label: string; className: string }> =
  {
    researching: { label: "調査中", className: "bg-muted text-muted-foreground" },
    visit_scheduled: {
      label: "見学予定",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    },
    visited: {
      label: "見学済み",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    shortlisted: {
      label: "候補",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    selected: {
      label: "決定",
      className: "bg-primary text-primary-foreground",
    },
    rejected: {
      label: "見送り",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
  };

export function VenueStatusBadge({ status }: { status: VenueStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
