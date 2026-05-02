import { connection } from "next/server";
import Link from "next/link";
import { Heart, Sparkles } from "lucide-react";
import { consumeFamilyInvitationView } from "@/server/actions/family-invitations";

/**
 * Track C-1 family read-only landing.
 *
 * Public — no auth, no cookie. Anyone who knows the URL can read it
 * (designer-warned protections — token strength + expiry + revoke + IP
 * rate limit — live in `consumeFamilyInvitationView`).
 *
 * Outside the `(app)/` segment so the bottom nav, project chrome, and
 * service-worker register don't render. Visitors get a static-feeling
 * page with no app affordances — just the venue announcement card and
 * a soft Haretoki attribution footer.
 *
 * `connection()` opts out of static prerender (we're calling a server
 * action that branches on per-request rate-limit state).
 */
export default async function FamilyInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const result = await consumeFamilyInvitationView(token);

  if (!result.ok) {
    return <InvalidCard reason={result.reason} />;
  }

  const { payload } = result;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-amber-50/40 via-background to-background pb-12 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-md space-y-8 px-5">
        <header className="space-y-2 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.3em] text-amber-700/80 dark:text-amber-300/80">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            From Haretoki
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-light tracking-tight text-foreground">
            式場が決まりました
          </h1>
          <p className="text-xs text-muted-foreground">{payload.decidedOnLabel} の決定です</p>
        </header>

        <article className="space-y-5 rounded-3xl bg-card p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)]">
          <div className="space-y-1.5 text-center">
            <p className="text-[10.5px] uppercase tracking-[0.3em] text-muted-foreground">
              Venue
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-light leading-snug text-foreground">
              {payload.venueName}
            </h2>
            {payload.venueLocation ? (
              <p className="text-xs text-muted-foreground">{payload.venueLocation}</p>
            ) : null}
          </div>

          {payload.scores.length > 0 ? (
            <div className="space-y-2.5">
              <p className="text-[10.5px] uppercase tracking-[0.3em] text-muted-foreground">
                Highlights
              </p>
              <ul className="space-y-2">
                {payload.scores.map((s) => (
                  <li
                    key={s.dimension}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-foreground">{s.dimension}</span>
                    <ScoreStars score={s.score} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {payload.rationale ? (
            <div className="space-y-1.5 rounded-2xl bg-muted/40 px-4 py-3">
              <p className="text-[10.5px] uppercase tracking-[0.3em] text-muted-foreground">
                Why we chose
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {payload.rationale}
              </p>
            </div>
          ) : null}
        </article>

        <footer className="space-y-3 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Heart className="h-3 w-3" aria-hidden="true" />
            ふたりからおふたりへ、おすそわけです
          </p>
          <Link
            href="/"
            prefetch={false}
            className="inline-block text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70 hover:text-foreground"
          >
            Powered by Haretoki
          </Link>
        </footer>
      </div>
    </div>
  );
}

/**
 * Star row — 6 / 5 / 4 / 3 etc. Renders as filled gold + muted track so
 * the family page reads at a glance even with no JS.
 */
function ScoreStars({ score }: { score: number }) {
  const max = 5;
  // Round to halves for display; full + half-step rendering keeps the
  // visual signal honest without forcing the family viewer to read a
  // floating-point number.
  const rounded = Math.round(score * 2) / 2;
  const full = Math.floor(rounded);
  const hasHalf = rounded - full === 0.5;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rounded.toFixed(1)} / ${max}`}
    >
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < full;
        const half = i === full && hasHalf;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={
              filled
                ? "text-amber-500"
                : half
                  ? "bg-gradient-to-r from-amber-500 from-50% to-muted to-50% bg-clip-text text-transparent"
                  : "text-muted"
            }
          >
            ★
          </span>
        );
      })}
    </span>
  );
}

/**
 * Generic landing for non-success results. We render the same layout
 * for `not-found`, `expired`, `revoked`, and `rate-limited` to avoid
 * giving an attacker a probe oracle (token-not-found vs token-revoked
 * leaks information about whether the token ever existed).
 */
function InvalidCard({
  reason,
}: {
  reason: "not-found" | "expired" | "revoked" | "rate-limited";
}) {
  const message =
    reason === "rate-limited"
      ? "アクセスが集中しています。少し時間をおいてからもう一度開いてみてください。"
      : "リンクの有効期限が切れているようです。お手数ですが、 ご家族にもう一度共有をお願いしてください。";
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-card p-8 text-center shadow-sm">
        <p className="inline-flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Haretoki
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-lg font-light tracking-tight text-foreground">
          このページは表示できません
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
