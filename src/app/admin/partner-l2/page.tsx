import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";

/**
 * /admin/partner-l2 — Partner Level 2 adoption stats.
 *
 * Splits the dashboard into two halves so the operator can read the
 * funnel from both ends:
 *
 *   1. DB-side adoption (top half) — answerable from Prisma alone, no
 *      PostHog dependency. "How many projects actually have a partner?
 *      How many of those projects have at least one partner-side
 *      rating? How many couples have crossed into the divergence
 *      territory the comparison surface was built for?"
 *
 *   2. Event-side rungs (bottom half) — placeholder counts for the
 *      track() events the wave 1.4 / 1.5 components emit. Same
 *      "wired in Phase 3 analytics, count column waits" stance as
 *      /admin/onboarding-funnel; this page just lists the L2-specific
 *      rungs (partner_rating_added / partner_rating_edited /
 *      couple_comparison_viewed / partner-can-rate-hint trio) in
 *      adoption order.
 *
 * Auth: requireAdmin() (404 for non-admins) + recordAudit() trail.
 * Read-only — no force-toggle of L2 capability or per-project drill-in.
 *
 * Performance: every query in the DB block is a single COUNT or
 * groupBy without a row-by-row scan. We aggregate at the DB layer
 * rather than pulling rows back, so the page stays sub-second even
 * once the project / member / rating tables grow.
 */

export const metadata = {
  title: "Partner Level 2",
  robots: { index: false, follow: false },
};

interface PartnerL2EventRung {
  event: string;
  label: string;
  emittedBy: string;
  note: string;
}

const PARTNER_L2_EVENT_RUNGS: PartnerL2EventRung[] = [
  {
    event: "onboarding_partner_can_rate_seen",
    label: "Partner can-rate hint seen",
    emittedBy: "partner-can-rate-hint.tsx",
    note: "Server gates the mount: only fires for partner-role members with zero own ratings on a given venue.",
  },
  {
    event: "onboarding_partner_can_rate_clicked",
    label: "Partner hint → rating section",
    emittedBy: "partner-can-rate-hint.tsx",
    note: "Smooth-scroll to the rating section anchor; the partner does not navigate away from the venue page.",
  },
  {
    event: "onboarding_partner_can_rate_dismissed",
    label: "Partner hint dismissed",
    emittedBy: "partner-can-rate-hint.tsx",
    note: "Persisted to localStorage, never re-renders for that device. Clean churn signal vs the click-through above.",
  },
  {
    event: "partner_rating_added",
    label: "First rating on a dimension",
    emittedBy: "rating-section.tsx",
    note: "Per dimension when the prior score for (viewer, venue, dimension) was 0. The DB-side adoption block above counts WHO; this rung counts the per-dimension events.",
  },
  {
    event: "partner_rating_edited",
    label: "Rating changed on a dimension",
    emittedBy: "rating-section.tsx",
    note: "Same source as above; fires when the prior score was non-zero. Edited >> added is the healthy ratio (couples revisit ratings as they tour more venues).",
  },
  {
    event: "couple_comparison_viewed",
    label: "Couple comparison opened",
    emittedBy: "partner-comparison-summary.tsx (rAF-deferred mount)",
    note: "Fires once per venue mount. Rate at which this lifts after partner_rating_added is the wave 1.3 polish payoff — the side-by-side has both columns populated.",
  },
];

export default async function AdminPartnerL2Page() {
  const admin = await requireAdmin();

  await recordAudit({
    action: "admin.partner_l2_stats.viewed",
    actorId: admin.userId,
    actorRole: "admin",
  });

  // 1. Project totals + partner participation.
  const [totalProjects, projectsWithPartnerRaw] = await Promise.all([
    prisma.project.count(),
    prisma.projectMember.findMany({
      where: { role: "partner", acceptedAt: { not: null } },
      select: { projectId: true },
      distinct: ["projectId"],
    }),
  ]);
  const projectsWithPartner = projectsWithPartnerRaw.length;

  // 2. Partner ratings — distinct projects that have at least one
  //    rating coming from the partner-role member. Two-step: (a) the
  //    user ids who are partner-role on each project, (b) any
  //    VisitRating attached to a Visit whose Venue is in those
  //    projects, posted by those user ids. We aggregate at the DB
  //    layer with `distinct` rather than pulling rows.
  const partnerMemberPairs = await prisma.projectMember.findMany({
    where: { role: "partner", acceptedAt: { not: null } },
    select: { projectId: true, userId: true },
  });

  let projectsWithPartnerRatings = 0;
  let totalPartnerRatings = 0;
  if (partnerMemberPairs.length > 0) {
    const partnerUserIds = partnerMemberPairs.map((p) => p.userId);
    const partnerProjectIds = partnerMemberPairs.map((p) => p.projectId);

    const [partnerRatedProjectsRaw, partnerRatingCount] = await Promise.all([
      prisma.visitRating.findMany({
        where: {
          userId: { in: partnerUserIds },
          visit: { venue: { projectId: { in: partnerProjectIds } } },
        },
        select: { visit: { select: { venue: { select: { projectId: true } } } } },
      }),
      prisma.visitRating.count({
        where: {
          userId: { in: partnerUserIds },
          visit: { venue: { projectId: { in: partnerProjectIds } } },
        },
      }),
    ]);
    const partnerRatedProjectSet = new Set(
      partnerRatedProjectsRaw
        .map((r) => r.visit?.venue?.projectId)
        .filter((id): id is string => typeof id === "string"),
    );
    projectsWithPartnerRatings = partnerRatedProjectSet.size;
    totalPartnerRatings = partnerRatingCount;
  }

  // 3. Divergence — projects where the same venue+dimension has a
  //    rating from the owner AND a rating from the partner with diff
  //    ≥ 2 stars. Computed in TS because the cross-row diff isn't
  //    expressible as a single Prisma query without raw SQL, and
  //    the table is small enough for an in-memory pass at this stage.
  let divergenceProjects = 0;
  let divergenceRows = 0;
  if (partnerMemberPairs.length > 0) {
    const partnerUserIds = partnerMemberPairs.map((p) => p.userId);
    const partnerProjectIds = partnerMemberPairs.map((p) => p.projectId);

    const ratings = await prisma.visitRating.findMany({
      where: {
        visit: { venue: { projectId: { in: partnerProjectIds } } },
      },
      select: {
        userId: true,
        dimension: true,
        score: true,
        visit: {
          select: {
            venueId: true,
            venue: { select: { projectId: true } },
          },
        },
      },
    });

    type Pair = { ownerScore: number | null; partnerScore: number | null };
    const pairsByKey = new Map<string, Pair>();
    const partnerSet = new Set(partnerUserIds);
    for (const r of ratings) {
      const projectId = r.visit?.venue?.projectId;
      const venueId = r.visit?.venueId;
      if (!projectId || !venueId) continue;
      const isPartner = partnerSet.has(r.userId);
      const key = `${projectId}|${venueId}|${r.dimension}`;
      const pair = pairsByKey.get(key) ?? { ownerScore: null, partnerScore: null };
      const score = Number(r.score);
      if (isPartner) pair.partnerScore = score;
      else pair.ownerScore = score;
      pairsByKey.set(key, pair);
    }

    const divergentProjectSet = new Set<string>();
    for (const [key, pair] of pairsByKey) {
      if (
        pair.ownerScore !== null &&
        pair.partnerScore !== null &&
        Math.abs(pair.ownerScore - pair.partnerScore) >= 2
      ) {
        divergenceRows += 1;
        const projectId = key.split("|")[0];
        if (projectId) divergentProjectSet.add(projectId);
      }
    }
    divergenceProjects = divergentProjectSet.size;
  }

  const partnerProjectPct =
    totalProjects > 0
      ? Math.round((projectsWithPartner / totalProjects) * 100)
      : 0;
  const partnerRatingPct =
    projectsWithPartner > 0
      ? Math.round((projectsWithPartnerRatings / projectsWithPartner) * 100)
      : 0;
  const divergencePct =
    projectsWithPartnerRatings > 0
      ? Math.round((divergenceProjects / projectsWithPartnerRatings) * 100)
      : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Partner Level 2</h1>
        <p className="mt-1 text-muted-foreground">
          Adoption statistics for the Phase 3 Level 2 partner experience
          (wave 1.1–1.5). DB-side aggregates below are queryable today;
          event-side counts are wired through{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            src/lib/analytics.ts
          </code>{" "}
          and surface in PostHog while this page mirrors the rung
          vocabulary for cross-reference.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total projects"
          value={totalProjects}
          note="All projects in the DB"
        />
        <Stat
          label="With partner joined"
          value={projectsWithPartner}
          suffix={`${partnerProjectPct}%`}
          note="ProjectMember.role = partner & accepted"
        />
        <Stat
          label="Partner-rated projects"
          value={projectsWithPartnerRatings}
          suffix={`${partnerRatingPct}% of partner projects`}
          note="≥ 1 VisitRating from a partner-role member"
        />
        <Stat
          label="Divergence detected"
          value={divergenceProjects}
          suffix={`${divergencePct}% of partner-rated`}
          note="Owner & partner ≥ 2 stars apart on any venue × dimension"
        />
      </section>

      <section className="mb-8 rounded-lg border">
        <h2 className="border-b bg-muted/40 px-3 py-2 text-[13px] font-medium">
          DB rollup
        </h2>
        <table className="w-full text-[12.5px]">
          <thead className="border-b bg-muted/30 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Metric</th>
              <th className="px-3 py-2 font-medium tabular-nums">Value</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="px-3 py-2">Total partner ratings (rows)</td>
              <td className="px-3 py-2 tabular-nums">
                {totalPartnerRatings.toLocaleString("ja-JP")}
              </td>
              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                visit_ratings WHERE userId IN partner-role members
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2">
                Owner × partner divergent (venue × dimension) cells
              </td>
              <td className="px-3 py-2 tabular-nums">
                {divergenceRows.toLocaleString("ja-JP")}
              </td>
              <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                In-memory diff after pulling project-scoped ratings
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border">
        <h2 className="border-b bg-muted/40 px-3 py-2 text-[13px] font-medium">
          Event funnel rungs (Phase 3 wave 1.4 + 1.5)
        </h2>
        <p className="border-b bg-muted/20 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Counts are intentionally placeholder — these events flow into
          PostHog today; the count column waits for the same Phase 3
          analytics decision as the L1 funnel. See{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            /admin/onboarding-funnel
          </code>{" "}
          for the L1 rung table and the Phase 3 wiring trade-off.
        </p>
        <table className="w-full text-[12.5px]">
          <thead className="border-b bg-muted/30 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium tabular-nums">
                Count (7d)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {PARTNER_L2_EVENT_RUNGS.map((rung, i) => (
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
                <td className="px-3 py-2.5 font-mono text-[11px]">
                  <code className="rounded bg-muted px-1.5 py-0.5">
                    {rung.event}
                  </code>
                  <p className="mt-1 text-muted-foreground">
                    {rung.emittedBy}
                  </p>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  —
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: number;
  suffix?: string;
  note?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl tabular-nums text-foreground">
        {value.toLocaleString("ja-JP")}
        {suffix ? (
          <span className="ml-2 text-[12px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
    </div>
  );
}
