import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getPreferenceVector } from "@/server/actions/preference-vector";

/**
 * Cycle 2 magic — visualizes the preference vector on /home so the
 * couple SEES the AI is learning what they're drawn to. Quiet card
 * with top 3 vibes + 1 area chip + a soft "ふたりっぽい式場をさがす"
 * CTA → /explore.
 *
 * Cold-start (signal < 2) returns null silently so first-time users
 * see the unchanged home layout. Server Component — zero client JS.
 */
export async function PreferencePulseCard() {
  const v = await getPreferenceVector();
  if (v.cold) return null;

  const showVibes = v.topVibes.length > 0;
  const showArea = v.topAreas.length > 0;
  if (!showVibes && !showArea) return null;

  return (
    <section
      aria-label="お二人の好み"
      className="rounded-3xl border border-[color-mix(in_oklab,var(--gold-warm)_20%,transparent)] bg-[color-mix(in_oklab,var(--gold-subtle)_50%,var(--card))] p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-eyebrow text-[var(--gold-warm)]">
          <Sparkles
            className="h-3 w-3"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          ふたりの色
        </p>
        <span className="tabular-nums text-eyebrow text-muted-foreground">
          {v.signalCount} venues
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <p className="font-[family-name:var(--font-display)] text-[15px] font-light leading-snug text-foreground">
          いままで惹かれてきた式場から、こんな好みが見えています
        </p>

        {showVibes && (
          <div className="flex flex-wrap gap-1.5">
            {v.topVibes.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--gold-warm)_22%,transparent)] bg-card/80 px-2.5 py-0.5 text-fluid-xs text-foreground/85"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {showArea && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            よく見ているエリア:{" "}
            <span className="font-medium text-foreground/85">
              {v.topAreas.join(" / ")}
            </span>
          </p>
        )}
      </div>

      <Link
        href="/explore"
        prefetch={true}
        className="mt-4 inline-flex min-h-11 items-center gap-1 text-fluid-sm text-[var(--gold-warm)] underline-offset-2 hover:underline"
      >
        ふたりっぽい式場をさがす →
      </Link>
    </section>
  );
}
