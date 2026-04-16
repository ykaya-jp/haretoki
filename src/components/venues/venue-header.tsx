import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
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
  const capacityText =
    capacityMin != null && capacityMax != null
      ? `${capacityMin}〜${capacityMax}名`
      : capacityMax != null
        ? `〜${capacityMax}名`
        : capacityMin != null
          ? `${capacityMin}名〜`
          : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h1 className="font-serif text-fluid-lg font-light tracking-[-0.01em]">{name}</h1>
        <VenueStatusBadge status={status} />
      </div>
      {/* Definition list — basic info grid */}
      <dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2">
        {location && (
          <>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground leading-7">エリア</dt>
            <dd className="text-sm leading-7 text-foreground">{location}</dd>
          </>
        )}
        {accessInfo && (
          <>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground leading-7">アクセス</dt>
            <dd className="text-sm leading-7 text-foreground">{accessInfo}</dd>
          </>
        )}
        {capacityText && (
          <>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground leading-7">収容人数</dt>
            <dd className="text-sm leading-7 tabular-nums text-foreground">着席 {capacityText}</dd>
          </>
        )}
      </dl>

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
