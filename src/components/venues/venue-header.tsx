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

  // Build a compact inline meta string for the eyebrow row
  const metaParts: string[] = [];
  if (location) metaParts.push(location);
  if (capacityText) metaParts.push(`着席 ${capacityText}`);

  return (
    <div className="space-y-3">
      {/* Layer 1 — eyebrow: ceremony style chips + meta inline */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {ceremonyStyles.length > 0 &&
          ceremonyStyles.map((style) => (
            <span
              key={style}
              className="text-eyebrow text-[var(--gold-warm)] uppercase"
            >
              {style}
            </span>
          ))}
        {ceremonyStyles.length > 0 && metaParts.length > 0 && (
          <span
            aria-hidden="true"
            className="text-[11px] text-muted-foreground/40"
          >
            ·
          </span>
        )}
        {metaParts.map((part, i) => (
          <span key={i} className="text-eyebrow text-muted-foreground">
            {part}
          </span>
        ))}
        <span
          aria-hidden="true"
          className="text-[11px] text-muted-foreground/40"
        >
          ·
        </span>
        <VenueStatusBadge status={status} />
      </div>

      {/* gold hairline */}
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] via-[color-mix(in_oklab,var(--gold-warm)_20%,transparent)] to-transparent"
      />

      {/* Layer 2 — h1: venue name in Noto Serif JP extralight 24-32px */}
      <h1 className="font-[family-name:var(--font-display)] text-[clamp(24px,6vw,32px)] font-light leading-[1.25] tracking-[-0.01em]">
        {name}
      </h1>

      {/* Layer 3 — definition list: access only (not repeated in eyebrow) */}
      {accessInfo && (
        <dl className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <dt className="text-eyebrow text-muted-foreground">アクセス</dt>
          <dd className="text-[13px] leading-relaxed text-muted-foreground">
            {accessInfo}
          </dd>
        </dl>
      )}
    </div>
  );
}
