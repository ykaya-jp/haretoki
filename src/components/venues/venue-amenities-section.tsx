"use client";

import { useUpdatedHighlight } from "./use-updated-highlight";
import { cn } from "@/lib/utils";

interface VenueAmenitiesSectionProps {
  hasParking: boolean | null;
  parkingCapacity: number | null;
  hasShuttle: boolean | null;
  hasAccommodation: boolean | null;
  acceptsSecondParty: boolean | null;
  barrierFree: boolean | null;
  operatingHours: string | null;
  closedDays: string[];
}

interface Chip {
  icon: string;
  label: string;
}

/**
 * Build the chip list from truthy props. Falsy and null values are omitted
 * so a venue that only has parking doesn't surface "送迎バス なし" — we
 * don't want to read "no" out loud, we only want to read "yes" out loud.
 *
 * Operating hours and closed days are shown when present even if they are
 * the only two facts, because time information reads as neutral.
 */
function buildChips(props: VenueAmenitiesSectionProps): Chip[] {
  const chips: Chip[] = [];
  if (props.hasParking === true) {
    const label =
      props.parkingCapacity != null && props.parkingCapacity > 0
        ? `駐車場 ${props.parkingCapacity}台`
        : "駐車場あり";
    chips.push({ icon: "🚗", label });
  }
  if (props.hasShuttle === true) chips.push({ icon: "🚌", label: "送迎バスあり" });
  if (props.hasAccommodation === true)
    chips.push({ icon: "🛏️", label: "提携宿泊あり" });
  if (props.acceptsSecondParty === true)
    chips.push({ icon: "🎉", label: "二次会 OK" });
  if (props.barrierFree === true)
    chips.push({ icon: "♿", label: "バリアフリー" });
  if (props.operatingHours && props.operatingHours.trim().length > 0) {
    chips.push({ icon: "🕒", label: `営業 ${props.operatingHours}` });
  }
  if (props.closedDays && props.closedDays.length > 0) {
    chips.push({ icon: "📅", label: `定休日: ${props.closedDays.join("・")}` });
  }
  return chips;
}

/**
 * Amenities — 設備と過ごし方 block rendered between Visit planning and
 * Review sections. Chip grid showing only the *true / non-empty* facts so
 * a venue with 2 facilities doesn't read like one with 7 missing ones.
 *
 * Decision trail:
 *   - Emoji leads each chip for fast visual scan; Tabelog / Airbnb follow
 *     the same icon-first pattern for facility lists.
 *   - Returns null (section disappears entirely) when zero chips build, so
 *     the page does not show a heading over a blank row.
 */
export function VenueAmenitiesSection(props: VenueAmenitiesSectionProps) {
  const highlight = useUpdatedHighlight();
  const chips = buildChips(props);

  if (chips.length === 0) return null;

  return (
    <section
      aria-label="設備と過ごし方"
      className={cn(
        "space-y-3 rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(42,35,32,0.04),0_4px_12px_rgba(42,35,32,0.05)] transition-[box-shadow,outline] duration-500",
        highlight && "ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={{ background: "var(--gold-warm)" }}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-foreground font-medium">
          設備と過ごし方
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <ul className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <li
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-[12.5px] text-foreground"
          >
            <span aria-hidden="true" className="leading-none">
              {c.icon}
            </span>
            <span>{c.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
