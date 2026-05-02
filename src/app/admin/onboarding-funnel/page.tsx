import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";

/**
 * /admin/onboarding-funnel — conversion funnel scaffold.
 *
 * Renders the seven onboarding events the client `track()` calls fire,
 * with placeholder counts. The actual numbers are intentionally NOT
 * read from a fresh ProjectOnboardingEvent Prisma table on this branch:
 *
 *   - Adding a new analytics table to prisma/schema.prisma collides
 *     with worker B's admin/audit migrations on this round.
 *   - The events already flow into PostHog via src/lib/analytics.ts;
 *     the operator can answer "how many couples completed step 3 last
 *     week?" today by querying PostHog directly.
 *   - A purpose-built dashboard table is a Phase 3 task: it should
 *     either pull from the PostHog query API server-side OR add the
 *     ProjectOnboardingEvent table once schema ownership is clear.
 *
 * This page exists now so:
 *   1. The /admin nav has the third tab populated (operators stop
 *      asking "where's the funnel?").
 *   2. The complete event vocabulary is visible in one place — when
 *      Phase 3 wires real numbers in, only the count column changes;
 *      the row list stays exactly the same.
 *   3. The audit trail records who looked, even if the page is empty.
 *
 * Auth: requireAdmin() (404 for non-admins). Style stays in the
 * operator-tool palette (plain border + tabular-nums) per the same
 * convention as /admin/cost — not the editorial brand surface.
 */

export const metadata = {
  title: "Onboarding Funnel",
  robots: { index: false, follow: false },
};

/**
 * Funnel rungs in the order a couple actually traverses them. The
 * `event` strings MUST stay in lockstep with the track() calls in
 * src/components/onboarding/*.tsx; the comment next to each row
 * names the file that emits it so a future edit only needs to grep
 * once. Step 1-4 share an event name with a `step` payload — they
 * are split out here for readability.
 */
const FUNNEL_RUNGS: Array<{
  event: string;
  payload?: Record<string, unknown>;
  label: string;
  emittedBy: string;
  note: string;
}> = [
  {
    event: "onboarding_hero_seen",
    label: "Hero impression",
    emittedBy: "onboarding-hero.tsx",
    note: "First /onboarding mount; fires once per session.",
  },
  {
    event: "onboarding_started",
    label: "Hero CTA tapped",
    emittedBy: "onboarding-hero.tsx",
    note: "「はじめる」 — couple commits to the question flow.",
  },
  {
    event: "onboarding_hero_deferred",
    label: "Hero deferred",
    emittedBy: "onboarding-hero.tsx",
    note: "「あとで」 / 「スキップして式場を追加」 — counts toward churn, not progress.",
  },
  {
    event: "onboarding_step_completed",
    payload: { step: 1, stepId: "style", label: "雰囲気" },
    label: "Step 1 / 4 — 雰囲気",
    emittedBy: "onboarding-flow.tsx (handleNext / handleSkip)",
    note: "Pulse fires on advance regardless of skip vs. answer.",
  },
  {
    event: "onboarding_step_completed",
    payload: { step: 2, stepId: "guests", label: "ゲスト人数" },
    label: "Step 2 / 4 — ゲスト人数",
    emittedBy: "onboarding-flow.tsx",
    note: "Number input — couples who skip leave guestCount unset.",
  },
  {
    event: "onboarding_step_completed",
    payload: { step: 3, stepId: "area", label: "エリア" },
    label: "Step 3 / 4 — エリア",
    emittedBy: "onboarding-flow.tsx",
    note: "AREA_OTHER_SENTINEL fallback couples are visible via answers.area length, not via this event.",
  },
  {
    event: "onboarding_step_completed",
    payload: { step: 4, stepId: "budget", label: "予算" },
    label: "Step 4 / 4 — 予算",
    emittedBy: "onboarding-flow.tsx",
    note: "Followed immediately by onboarding_completed; the gap between this and the next row is the API-fetch latency.",
  },
  {
    event: "onboarding_completed",
    label: "Recommendations reached",
    emittedBy: "onboarding-flow.tsx (handleNext final-step branch + handleSkip final-step branch)",
    note: "Payload includes hasStyle / hasGuestCount / hasArea / hasBudget so partial-fill rates are queryable in PostHog without re-instrumenting.",
  },
  {
    event: "onboarding_partner_hint_seen",
    label: "Partner hint seen",
    emittedBy: "onboarding-partner-hint.tsx",
    note: "Only fires for couples who reached recommendations (the hint is rendered there).",
  },
  {
    event: "onboarding_partner_hint_clicked",
    label: "Partner hint → /mypage#partner-invite",
    emittedBy: "onboarding-partner-hint.tsx",
    note: "Couples who tapped the gold CTA and crossed into the invite flow.",
  },
  {
    event: "onboarding_partner_hint_dismissed",
    label: "Partner hint dismissed",
    emittedBy: "onboarding-partner-hint.tsx",
    note: "Couples who tapped × — gentle dismiss, persisted to localStorage so the hint never re-renders.",
  },
];

/**
 * Partner Level 2 funnel rungs (Phase 3 wave 1.5).
 *
 * Once the partner has joined the project, this is the funnel that
 * tracks how far they walk into "actually using" their new full-member
 * powers — first they SEE the upgrade hint on a venue page, then they
 * either dismiss it or click through to the rating section, then they
 * leave their first own rating, then they (eventually) come back and
 * edit it, and finally they open the couple-comparison surface to
 * compare their scores against the owner's.
 *
 * Same `event` + `payload` contract as the L1 funnel above — the
 * count column is still placeholder until either PostHog query or a
 * dedicated Prisma table lands. The rows EXIST now so when we wire
 * counts in, partner adoption is visible end-to-end on day one.
 */
const PARTNER_L2_RUNGS: Array<{
  event: string;
  payload?: Record<string, unknown>;
  label: string;
  emittedBy: string;
  note: string;
}> = [
  {
    event: "onboarding_partner_can_rate_seen",
    label: "Partner can-rate hint seen",
    emittedBy: "partner-can-rate-hint.tsx (wave 1.4)",
    note: "Server gates the mount: only fires for partner-role members with zero own ratings on this venue. Idempotent per dismiss state.",
  },
  {
    event: "onboarding_partner_can_rate_clicked",
    label: "Partner hint → rating section",
    emittedBy: "partner-can-rate-hint.tsx",
    note: "Tap on 「自分の評価を加える」 — smooth-scrolls to the rating section instead of navigating away (Wave 1.1 made the section editable for partner role).",
  },
  {
    event: "onboarding_partner_can_rate_dismissed",
    label: "Partner can-rate hint dismissed",
    emittedBy: "partner-can-rate-hint.tsx",
    note: "Tap × — persisted to localStorage, never re-renders. Clean churn signal vs the click-through above.",
  },
  {
    event: "partner_rating_added",
    label: "First rating on a dimension",
    emittedBy: "rating-section.tsx (debouncedSave success branch)",
    note: "Fires per dimension when the previous score for that (viewer, venue, dimension) was 0. Role-agnostic by design: the funnel measures couple participation, not owner-vs-partner segmentation (the user id is on every event for downstream split).",
  },
  {
    event: "partner_rating_edited",
    label: "Rating changed on a dimension",
    emittedBy: "rating-section.tsx",
    note: "Same source as above; fires when the previous score was non-zero. Edited >> added is the healthy ratio (couples revisit ratings as they tour more venues).",
  },
  {
    event: "couple_comparison_viewed",
    label: "Couple comparison opened",
    emittedBy: "partner-comparison-summary.tsx (mount effect, rAF deferred)",
    note: "Fires once per venueId mount. The rate at which this lifts after a partner_rating_added is the wave 1.3 polish payoff — the side-by-side now has both columns populated.",
  },
];

function fmtPayload(p: Record<string, unknown> | undefined): string {
  if (!p) return "—";
  return Object.entries(p)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(" ");
}

export default async function AdminOnboardingFunnelPage() {
  const admin = await requireAdmin();

  await recordAudit({
    action: "admin.onboarding_funnel.viewed",
    actorId: admin.userId,
    actorRole: "admin",
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Onboarding Funnel</h1>
        <p className="mt-1 text-muted-foreground">
          Conversion funnel scaffold. The event vocabulary is the source
          of truth — wire it to a real counter source in Phase 3.
        </p>
        <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[12.5px] leading-relaxed text-amber-700 dark:text-amber-300">
          <strong>Counts pending.</strong> Events listed below already flow
          into PostHog (via{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            src/lib/analytics.ts
          </code>
          ). To populate the count column, either query the PostHog API
          server-side here, or add{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            ProjectOnboardingEvent
          </code>{" "}
          in a Phase 3 schema migration. Both options are open; this page
          deliberately ships without picking one so the choice can be made
          alongside the rest of the Phase 3 analytics surface.
        </p>
      </header>

      <section className="rounded-lg border">
        <header className="border-b bg-muted/20 px-3 py-2.5">
          <h2 className="text-[13px] font-medium">
            L1 — Onboarding to recommendations
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Hero impression → recommendations reached → partner invite hint.
          </p>
        </header>
        <table className="w-full text-[13px]">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Payload filter</th>
              <th className="px-3 py-2 font-medium tabular-nums">Count (7d)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {FUNNEL_RUNGS.map((rung, i) => (
              <tr key={`${rung.event}-${i}`} className="align-top">
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{rung.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {rung.note}
                  </p>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11.5px]">
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {rung.event}
                  </code>
                  <p className="mt-1 text-muted-foreground">{rung.emittedBy}</p>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11.5px] text-muted-foreground">
                  {fmtPayload(rung.payload)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  —
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-lg border">
        <header className="border-b bg-muted/20 px-3 py-2.5">
          <h2 className="text-[13px] font-medium">
            L2 — Partner participation (Phase 3 wave 1.x)
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            Upgrade hint → first own rating → couple comparison opened. Where
            the funnel narrows tells us whether the L2 surface is reaching
            partners and whether they actually rate after seeing it.
          </p>
        </header>
        <table className="w-full text-[13px]">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Payload filter</th>
              <th className="px-3 py-2 font-medium tabular-nums">Count (7d)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {PARTNER_L2_RUNGS.map((rung, i) => (
              <tr key={`${rung.event}-${i}`} className="align-top">
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{rung.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {rung.note}
                  </p>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11.5px]">
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {rung.event}
                  </code>
                  <p className="mt-1 text-muted-foreground">{rung.emittedBy}</p>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11.5px] text-muted-foreground">
                  {fmtPayload(rung.payload)}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  —
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 space-y-2 text-[12.5px] text-muted-foreground">
        <h2 className="text-[13px] font-medium text-foreground">
          Phase 3 wiring options
        </h2>
        <ol className="ml-5 list-decimal space-y-1.5">
          <li>
            <strong>PostHog query API.</strong> Server-render this page
            with a fetch to the project&apos;s PostHog instance using
            <code className="mx-1 rounded bg-muted px-1 py-0.5">
              POSTHOG_PROJECT_API_KEY
            </code>
            . Pros: no schema change, real numbers immediately.
            Cons: another upstream to keep alive; does not survive
            PostHog cap exceedance.
          </li>
          <li>
            <strong>ProjectOnboardingEvent Prisma table.</strong> Mirror
            the PostHog stream into Postgres on the same Server Action
            that fires <code className="rounded bg-muted px-1 py-0.5">
              track()
            </code>
            . Pros: durable, queryable from any other admin page, no
            third-party dependency. Cons: schema migration + per-event
            insert latency.
          </li>
        </ol>
        <p>
          Pick one when the rest of Phase 3 analytics is scoped — the
          event names + payload shapes above are the contract that holds
          either decision in place.
        </p>
      </section>
    </main>
  );
}
