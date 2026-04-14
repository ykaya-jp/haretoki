import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import { MapPin, Users } from "lucide-react";
import type { VenueStatus } from "@/generated/prisma/client";

interface VenueHeaderProps {
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  status: VenueStatus;
}

export function VenueHeader({
  name,
  location,
  accessInfo,
  capacityMin,
  capacityMax,
  ceremonyStyles,
  status,
}: VenueHeaderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h1 className="font-serif text-fluid-lg font-light tracking-[0.03em]">{name}</h1>
        <VenueStatusBadge status={status} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {location}
          </span>
        )}
        {accessInfo && <span>{accessInfo}</span>}
        {(capacityMin || capacityMax) && (
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            着席
            {capacityMin && capacityMax
              ? `${capacityMin}〜${capacityMax}名`
              : capacityMax
                ? `〜${capacityMax}名`
                : `${capacityMin}名〜`}
          </span>
        )}
      </div>
      {ceremonyStyles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ceremonyStyles.map((style) => (
            <span
              key={style}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {style}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
