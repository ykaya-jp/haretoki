import { MessageCircle } from "lucide-react";
import type { VenueDisagreement } from "@/server/actions/disagreement-spotlight";

/**
 * Surface where partner ratings diverge most across the comparison.
 * Renders nothing on solo projects or when no dimension exceeds the
 * delta threshold (≥1.0). Pairs with MatrixInsight (定量) and
 * MatrixReviewInsight (定性) as the third "what to discuss" lens —
 * specifically about partner agreement.
 */
export function DisagreementSpotlightCard({
  disagreements,
}: {
  disagreements: VenueDisagreement[];
}) {
  if (disagreements.length === 0) return null;

  return (
    <section
      aria-label="話し合うとよさそうな点"
      className="rounded-2xl border border-[color-mix(in_oklab,var(--gold-warm)_22%,transparent)] bg-[color-mix(in_oklab,var(--gold-subtle)_55%,var(--card))] p-5"
    >
      <div className="flex items-center gap-2">
        <MessageCircle
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p className="text-eyebrow text-[var(--gold-warm)]">
          話し合うとよさそうな点
        </p>
      </div>

      <p className="mt-2 text-fluid-xs leading-relaxed text-muted-foreground">
        評価が分かれた箇所は、決め手になりやすい場所です。
      </p>

      <ul className="mt-3 space-y-2.5">
        {disagreements.map((d) => (
          <li
            key={`${d.venueId}-${d.dimension}`}
            className="flex flex-col gap-1 rounded-xl bg-card/80 p-3"
          >
            <p className="text-fluid-sm leading-snug text-foreground">
              <span className="font-[family-name:var(--font-display)]">
                {d.venueName}
              </span>
              <span className="text-muted-foreground">で「</span>
              <span className="font-medium text-[var(--gold-warm)]">
                {d.dimensionLabel}
              </span>
              <span className="text-muted-foreground">」に温度差。</span>
            </p>
            <p className="flex items-baseline gap-3 text-fluid-xs text-muted-foreground">
              <span>
                <span className="text-foreground/85">{d.ownerName}</span>{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {d.ownerScore.toFixed(1)}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="text-foreground/85">{d.partnerName}</span>{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {d.partnerScore.toFixed(1)}
                </span>
              </span>
              <span aria-hidden="true" className="ml-auto text-[var(--gold-warm)]">
                差 {d.delta.toFixed(1)}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
