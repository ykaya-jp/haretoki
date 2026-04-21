"use client";

import { useState, useTransition } from "react";
import { updateVenueStatus } from "@/server/actions/venues";
import type { VenueStatus } from "@/generated/prisma/client";
import { toast } from "sonner";

// Labels must match src/components/explore/explore-content.tsx STATUS_FILTERS
// so the same enum value surfaces the same Japanese word everywhere.
// (researching / shortlisted had drifted between the two files — that
// was the "検討中 / 候補 / 調査中 の関係が地獄" feedback.)
const STATUS_OPTIONS: { value: VenueStatus; label: string }[] = [
  { value: "researching", label: "気になる" },
  { value: "visit_scheduled", label: "見学予定" },
  { value: "visited", label: "見学済み" },
  { value: "shortlisted", label: "検討中" },
  { value: "rejected", label: "見送り" },
];

interface VenueStatusSelectProps {
  venueId: string;
  currentStatus: VenueStatus;
}

export function VenueStatusSelect({
  venueId,
  currentStatus,
}: VenueStatusSelectProps) {
  const [status, setStatus] = useState<VenueStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value as VenueStatus;
    setStatus(newStatus);
    startTransition(async () => {
      await updateVenueStatus(venueId, newStatus);
      toast.success("変えました");
    });
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={isPending}
      className="min-h-[44px] rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
