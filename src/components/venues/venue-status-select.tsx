"use client";

import { useState, useTransition } from "react";
import { updateVenueStatus } from "@/server/actions/venues";
import type { VenueStatus } from "@/generated/prisma/client";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: VenueStatus; label: string }[] = [
  { value: "researching", label: "調査中" },
  { value: "visit_scheduled", label: "見学予定" },
  { value: "visited", label: "見学済み" },
  { value: "shortlisted", label: "候補" },
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
      toast.success("更新しました ✨");
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
