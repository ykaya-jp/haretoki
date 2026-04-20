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

  // Pack the dense inline meta row after the h1 — access / area /
  // capacity / ceremony styles in one scannable line separated by "·".
  // Previously had access floating in its own dl and ceremony styles
  // scattered across the eyebrow, so couples had to read three rows to
  // pick up what Airbnb / Zola convey in one. Null values drop cleanly
  // rather than leaving empty "·" separators.
  const metaParts: string[] = [];
  if (accessInfo) metaParts.push(accessInfo);
  if (location && location !== accessInfo) metaParts.push(location);
  if (capacityText) metaParts.push(`着席 ${capacityText}`);
  if (ceremonyStyles.length > 0) {
    // Join ceremony styles with "&" so "チャペル & ガーデン" reads as
    // one package, not two separate items in the meta row.
    metaParts.push(ceremonyStyles.join(" & "));
  }

  return (
    <div className="space-y-3">
      {/* Status eyebrow — tiny row above the h1 so the current lifecycle
          stage (気になる / 検討中 / 決定) is visible without crowding the
          inline meta line. */}
      <div className="flex items-center gap-2">
        <VenueStatusBadge status={status} />
      </div>

      {/* gold hairline */}
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] via-[color-mix(in_oklab,var(--gold-warm)_20%,transparent)] to-transparent"
      />

      {/* h1 — venue name in Noto Serif JP extralight 24-32px */}
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(24px,6vw,32px)] font-light leading-[1.25] tracking-[-0.01em]">
        {name}
      </h1>

      {/* Dense meta line — access · area · capacity · ceremony styles */}
      {metaParts.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {metaParts.map((part, i) => (
            <span key={i} className="inline-flex items-center gap-x-2">
              {i > 0 && (
                <span aria-hidden="true" className="opacity-40">
                  ·
                </span>
              )}
              <span>{part}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
