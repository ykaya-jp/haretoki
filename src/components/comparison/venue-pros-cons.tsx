import { Check, AlertCircle } from "lucide-react";
import { deriveProsCons } from "@/lib/venue-pros-cons";

/**
 * Compact Pros/Cons block for a single venue's column on /compare.
 * Renders nothing when both lists are empty (mid-range scores) so
 * data-poor venues don't show a hollow card.
 */
export function VenueProsCons({
  scoresByDimension,
  size = "sm",
}: {
  scoresByDimension: Record<string, number | null>;
  size?: "sm" | "md";
}) {
  const { pros, cons } = deriveProsCons(scoresByDimension);
  if (pros.length === 0 && cons.length === 0) return null;

  const proIconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const labelClass = size === "md" ? "text-fluid-xs" : "text-[11px]";

  return (
    <div className="space-y-1.5">
      {pros.length > 0 && (
        <ul className="space-y-1">
          {pros.map((p) => (
            <li
              key={p.dim}
              className={`flex items-baseline gap-1.5 ${labelClass} text-foreground/85`}
            >
              <Check
                aria-hidden="true"
                className={`${proIconSize} mt-0.5 shrink-0 text-[var(--gold-warm)]`}
                strokeWidth={2}
              />
              <span>
                <span className="text-foreground">{p.label}</span>
                <span className="ml-1 tabular-nums text-muted-foreground">
                  {p.score.toFixed(1)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {cons.length > 0 && (
        <ul className="space-y-1">
          {cons.map((c) => (
            <li
              key={c.dim}
              className={`flex items-baseline gap-1.5 ${labelClass} text-muted-foreground`}
            >
              <AlertCircle
                aria-hidden="true"
                className={`${proIconSize} mt-0.5 shrink-0 text-muted-foreground/70`}
                strokeWidth={1.6}
              />
              <span>
                <span>{c.label}</span>
                <span className="ml-1 tabular-nums">{c.score.toFixed(1)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
