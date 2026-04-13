import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/generated/prisma/client";

const STATUS_CONFIG: Record<VenueStatus, { label: string; className: string }> =
  {
    researching: { label: "調査中", className: "" },
    visit_scheduled: {
      label: "見学予定",
      className: "bg-amber-50/90 text-amber-800",
    },
    visited: {
      label: "見学済み",
      className: "bg-blue-50/90 text-blue-800",
    },
    shortlisted: {
      label: "候補",
      className: "bg-green-50/90 text-green-800",
    },
    selected: {
      label: "決定",
      className: "bg-primary text-primary-foreground",
    },
    rejected: {
      label: "見送り",
      className: "bg-red-50/90 text-red-800",
    },
  };

export function VenueStatusBadge({ status }: { status: VenueStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-foreground shadow-sm",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
