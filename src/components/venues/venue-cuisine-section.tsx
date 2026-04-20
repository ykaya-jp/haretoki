"use client";

import { useUpdatedHighlight } from "./use-updated-highlight";
import { cn } from "@/lib/utils";

interface VenueCuisineSectionProps {
  /** Enum-constrained IDs from CUISINE_TYPE_IDS: french / japanese / italian / chinese / fusion / buffet. */
  cuisineTypes: string[];
  /** Short free text about the chef, e.g. "元 Ritz-Carlton 料理長・○○ 監修". */
  chefCredentials: string | null;
}

// Map from CUISINE_TYPE_IDS enum to Japanese display + icon. Keep this
// table narrow — only the IDs the extractor is allowed to emit. Unknown IDs
// fall through to the raw id as a defensive fallback.
const CUISINE_LABEL: Record<string, { label: string; icon: string }> = {
  french: { label: "フレンチ", icon: "🇫🇷" },
  japanese: { label: "和食", icon: "🍵" },
  italian: { label: "イタリアン", icon: "🇮🇹" },
  chinese: { label: "中華", icon: "🥟" },
  fusion: { label: "フュージョン", icon: "✨" },
  buffet: { label: "ビュッフェ", icon: "🍽️" },
};

/**
 * Cuisine — 料理・シェフ block rendered above AI Analysis. Short, light:
 * chip row of cuisine types + optional one-line chef credential paragraph.
 *
 * Placement rationale: right before AI Analysis means it sits at the
 * bottom of the factual rail, immediately before the AI summary that
 * often *talks* about 料理 quality. Helps the user anchor the AI opinion
 * to the concrete cuisine data.
 */
export function VenueCuisineSection({
  cuisineTypes,
  chefCredentials,
}: VenueCuisineSectionProps) {
  const highlight = useUpdatedHighlight();

  const hasCuisine = cuisineTypes && cuisineTypes.length > 0;
  const hasChef = !!chefCredentials && chefCredentials.trim().length > 0;

  if (!hasCuisine && !hasChef) return null;

  return (
    <section
      aria-label="料理・シェフ"
      className={cn(
        "space-y-3 rounded-2xl bg-card p-5 shadow-[var(--shadow-card-low)] transition-[box-shadow,outline] duration-500",
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
          料理・シェフ
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {hasCuisine && (
        <ul className="flex flex-wrap gap-2">
          {cuisineTypes.map((id) => {
            const meta = CUISINE_LABEL[id] ?? { label: id, icon: "•" };
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/50 px-3 py-1.5 text-[12.5px] text-foreground"
              >
                <span aria-hidden="true" className="leading-none">
                  {meta.icon}
                </span>
                <span>{meta.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {hasChef && (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {chefCredentials}
        </p>
      )}
    </section>
  );
}
