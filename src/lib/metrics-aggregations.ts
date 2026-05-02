/**
 * Pure helpers for the long-term metrics dashboard + monthly report.
 *
 * Lives in `lib/` (no Prisma / no fetch) so the spec runner can pin
 * the math without standing up a DB. The page + cron each do their own
 * I/O and pass raw rows in.
 *
 * What this module does NOT do:
 *   - It does NOT pretend we have proper DAU tracking. We don't have a
 *     `user_activity` table or PostHog ingestion at this stage. The
 *     "active user" proxy is "any user who appeared as actor_id in
 *     audit_logs OR recipient_user_id in notifications within the
 *     window". Both surfaces under-count truly engaged users (browse-
 *     only users leave no audit row), so headline DAU is a LOWER bound,
 *     not a true count.
 *   - It does NOT do retention by signup-cohort × calendar week — that
 *     requires a User.createdAt + an activity stream, which we have but
 *     aggregating it costs N×M queries. Phase 5 candidate, see
 *     docs/business/churn-prediction-model.md.
 *
 * What it does do — exact aggregations of what we DO have:
 *   - partner adoption rate (= projects with 2 acceptedAt members /
 *     total projects)
 *   - decision rate (= projects with a Decision row / total projects)
 *   - avg venues per project (= total venues / total projects)
 *   - distinct active user count from a list of user IDs (the page
 *     queries the rows; this helper just counts them honestly)
 *   - cohort breakdown of "active in last N days" given the activity
 *     IDs the page passes in
 */

export interface PartnerAdoptionInput {
  totalProjects: number;
  /** Projects with ≥ 2 acceptedAt ProjectMember rows. */
  projectsWithPartner: number;
}

export interface PartnerAdoptionResult {
  totalProjects: number;
  projectsWithPartner: number;
  /** 0-100, rounded to 1 decimal. 0 when totalProjects = 0. */
  ratePct: number;
}

export function computePartnerAdoptionRate(
  input: PartnerAdoptionInput,
): PartnerAdoptionResult {
  const { totalProjects, projectsWithPartner } = input;
  const ratePct =
    totalProjects > 0
      ? Math.round((projectsWithPartner / totalProjects) * 1000) / 10
      : 0;
  return { totalProjects, projectsWithPartner, ratePct };
}

export interface DecisionRateInput {
  totalProjects: number;
  totalDecisions: number;
}

export interface DecisionRateResult {
  totalProjects: number;
  totalDecisions: number;
  /** 0-100, rounded to 1 decimal. */
  ratePct: number;
}

export function computeDecisionRate(input: DecisionRateInput): DecisionRateResult {
  const { totalProjects, totalDecisions } = input;
  const ratePct =
    totalProjects > 0
      ? Math.round((totalDecisions / totalProjects) * 1000) / 10
      : 0;
  return { totalProjects, totalDecisions, ratePct };
}

export interface AvgVenuesInput {
  totalProjects: number;
  totalVenues: number;
}

export interface AvgVenuesResult {
  totalProjects: number;
  totalVenues: number;
  /** Rounded to 1 decimal. 0 when totalProjects = 0. */
  avgPerProject: number;
}

export function computeAvgVenuesPerProject(input: AvgVenuesInput): AvgVenuesResult {
  const { totalProjects, totalVenues } = input;
  const avgPerProject =
    totalProjects > 0
      ? Math.round((totalVenues / totalProjects) * 10) / 10
      : 0;
  return { totalProjects, totalVenues, avgPerProject };
}

/**
 * Distinct active user count from a list of user IDs gathered by the
 * caller (notifications.userId + audit_logs.actorId etc). Returns
 * the deduped count + the deduped Set if the caller wants to chain.
 *
 * Caller is responsible for passing the right time window — this
 * helper makes no assumption about what "active" means. It just
 * dedupes and counts.
 */
export function countDistinctUsers(userIds: ReadonlyArray<string>): {
  count: number;
  ids: ReadonlySet<string>;
} {
  const set = new Set<string>();
  for (const id of userIds) {
    if (id) set.add(id);
  }
  return { count: set.size, ids: set };
}

/**
 * Bucket counts for the metrics dashboard's "activity at a glance"
 * row. Each bucket is the deduped distinct-user count over the
 * implied window — the caller fetches the row IDs for each window
 * and passes them in.
 */
export interface ActivityWindowsInput {
  dayUserIds: ReadonlyArray<string>;
  weekUserIds: ReadonlyArray<string>;
  monthUserIds: ReadonlyArray<string>;
}

export interface ActivityWindowsResult {
  dau: number;
  wau: number;
  mau: number;
  /**
   * dau / mau ratio (0-100, rounded to 1 decimal). High = engaged
   * userbase that comes back daily; low = mostly weekly/monthly visit
   * shape. 0 when mau = 0. Industry rough rule of thumb: > 20% is
   * "social-app sticky", 5-20% "utility sticky", < 5% "occasional".
   */
  stickinessPct: number;
}

export function computeActivityWindows(
  input: ActivityWindowsInput,
): ActivityWindowsResult {
  const dau = countDistinctUsers(input.dayUserIds).count;
  const wau = countDistinctUsers(input.weekUserIds).count;
  const mau = countDistinctUsers(input.monthUserIds).count;
  const stickinessPct = mau > 0 ? Math.round((dau / mau) * 1000) / 10 : 0;
  return { dau, wau, mau, stickinessPct };
}

/**
 * Stage funnel — how many users / projects make it past each
 * milestone of the core experience. Pure rollup of counts the
 * caller pulls.
 */
export interface FunnelInput {
  totalUsers: number;
  totalProjects: number;
  projectsWithVenue: number;
  projectsWithVisit: number;
  projectsWithDecision: number;
}

export interface FunnelStep {
  label: string;
  count: number;
  /** % of totalUsers that reached this step. 0 when totalUsers = 0. */
  pctOfUsers: number;
}

export function computeFunnel(input: FunnelInput): FunnelStep[] {
  const denom = input.totalUsers;
  const pct = (n: number) =>
    denom > 0 ? Math.round((n / denom) * 1000) / 10 : 0;
  return [
    { label: "registered users", count: input.totalUsers, pctOfUsers: 100 },
    {
      label: "started a project",
      count: input.totalProjects,
      pctOfUsers: pct(input.totalProjects),
    },
    {
      label: "added a venue",
      count: input.projectsWithVenue,
      pctOfUsers: pct(input.projectsWithVenue),
    },
    {
      label: "scheduled a visit",
      count: input.projectsWithVisit,
      pctOfUsers: pct(input.projectsWithVisit),
    },
    {
      label: "made a decision",
      count: input.projectsWithDecision,
      pctOfUsers: pct(input.projectsWithDecision),
    },
  ];
}

/**
 * Day-1-of-month detector for crons that should only fire once a
 * month but use a daily Vercel schedule for Hobby-plan compatibility.
 * Pure — caller passes `now` for tests.
 */
export function isFirstOfUtcMonth(now: Date): boolean {
  return now.getUTCDate() === 1;
}

/**
 * Build the previous-calendar-month window for the monthly report.
 * Returns UTC start (inclusive) + UTC end (exclusive) of the prior
 * calendar month given `now` is in the next month's day 1.
 * Example: `now = 2026-06-01T06:00Z` → window `[2026-05-01, 2026-06-01)`.
 *
 * Pure — caller passes `now`. Returned dates are UTC midnight.
 */
export function previousMonthWindow(now: Date): {
  start: Date;
  end: Date;
  monthLabel: string;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  // Format YYYY-MM for the report subject line (e.g. "2026-05").
  const labelMonth = String(start.getUTCMonth() + 1).padStart(2, "0");
  const monthLabel = `${start.getUTCFullYear()}-${labelMonth}`;
  return { start, end, monthLabel };
}
