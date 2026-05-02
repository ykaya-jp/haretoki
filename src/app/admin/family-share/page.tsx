import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";

/**
 * /admin/family-share — read-only family share invitation dashboard.
 *
 * Surfaces three things the operator needs to triage a "is this link
 * being abused?" question without dropping into psql:
 *
 *   1. The most recent 50 invitations across all projects (active first,
 *      then revoked / expired) so operator can see lifecycle at a glance.
 *   2. Aggregate counts — total issued, active, revoked, expired, plus
 *      total view-count across all links — so a daily glance shows
 *      "are couples actually using share links" without a per-row
 *      manual sum.
 *   3. Suspicious-access flagging: any single IP (hashed via the same
 *      sha256 recipe the public route uses) that has driven ≥ 10 views
 *      across multiple invitations gets called out at the top, since
 *      the C-1 design's "URL leak is the realistic threat model"
 *      manifests as exactly that pattern.
 *
 * Auth: requireAdmin() (404 for non-admins). Style stays in the
 * operator-tool palette per /admin/cost convention — plain HTML +
 * tabular-nums, not the editorial brand surfaces.
 *
 * Read-only by design: no revoke / kill-switch buttons here. The
 * existing per-project "revoke link" UI on /mypage is the canonical
 * surface and has the right auth context (project owner). Adding
 * cross-project revoke from the admin shell would mean writing without
 * the project-membership check, which is a footgun we don't need.
 */

export const metadata = {
  title: "Family share",
  robots: { index: false, follow: false },
};

interface InvitationRow {
  id: string;
  projectId: string;
  projectName: string | null;
  creatorEmail: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  lastViewedIpHash: string | null;
}

function fmtJst(d: Date | null | undefined): string {
  if (!d) return "—";
  // Cron and audit log conventionally show JST date+time; mirror that
  // here so admin pages are mutually comparable.
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function lifecycleStatus(row: InvitationRow): {
  label: string;
  tone: "active" | "revoked" | "expired";
} {
  if (row.revokedAt) return { label: "revoked", tone: "revoked" };
  if (row.expiresAt < new Date()) return { label: "expired", tone: "expired" };
  return { label: "active", tone: "active" };
}

export default async function AdminFamilyShareePage() {
  const admin = await requireAdmin();

  await recordAudit({
    action: "admin.family_share.viewed",
    actorId: admin.userId,
    actorRole: "admin",
  });

  const [rawInvitations, totals] = await Promise.all([
    prisma.familyInvitation.findMany({
      orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        project: { select: { name: true } },
        creator: { select: { email: true } },
      },
    }),
    prisma.familyInvitation.aggregate({
      _count: { _all: true },
      _sum: { viewCount: true },
    }),
  ]);

  const now = new Date();
  const [activeCount, revokedCount, expiredCount] = await Promise.all([
    prisma.familyInvitation.count({
      where: { revokedAt: null, expiresAt: { gt: now } },
    }),
    prisma.familyInvitation.count({ where: { revokedAt: { not: null } } }),
    prisma.familyInvitation.count({
      where: { revokedAt: null, expiresAt: { lte: now } },
    }),
  ]);

  const invitations: InvitationRow[] = rawInvitations.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.project?.name ?? null,
    creatorEmail: r.creator?.email ?? null,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    revokedAt: r.revokedAt,
    viewCount: r.viewCount,
    lastViewedAt: r.lastViewedAt,
    lastViewedIpHash: r.lastViewedIpHash,
  }));

  // Suspicious access detection: an IP hash that appears as the
  // last-viewed source on ≥ 2 distinct invitations AND drove ≥ 10
  // total views is the crude shape of "leaked URL being mass-tapped".
  // We can't see the full per-view IP history (the schema only stores
  // the *latest* hash per invitation, by design — the public route
  // never persists per-view rows to keep storage tiny), so this is a
  // signal, not a verdict.
  const ipBuckets = new Map<
    string,
    { invitations: number; totalViews: number }
  >();
  for (const r of rawInvitations) {
    if (!r.lastViewedIpHash || r.viewCount === 0) continue;
    const bucket = ipBuckets.get(r.lastViewedIpHash) ?? {
      invitations: 0,
      totalViews: 0,
    };
    bucket.invitations += 1;
    bucket.totalViews += r.viewCount;
    ipBuckets.set(r.lastViewedIpHash, bucket);
  }
  const suspiciousIps = Array.from(ipBuckets.entries())
    .filter(([, b]) => b.invitations >= 2 && b.totalViews >= 10)
    .sort((a, b) => b[1].totalViews - a[1].totalViews);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Family share</h1>
        <p className="mt-1 text-muted-foreground">
          Read-only family invitation dashboard. Source:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            family_invitations
          </code>{" "}
          (most recent 50 rows + aggregates).
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total issued" value={totals._count._all} />
        <Stat label="Active" value={activeCount} tone="ok" />
        <Stat label="Revoked" value={revokedCount} tone="warn" />
        <Stat label="Expired" value={expiredCount} tone="warn" />
        <Stat
          label="Total views"
          value={totals._sum.viewCount ?? 0}
          colSpan
        />
      </section>

      {suspiciousIps.length > 0 && (
        <section className="mb-8 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-[12.5px] leading-relaxed text-amber-700 dark:text-amber-300">
          <p className="font-medium">
            Suspicious-access signal: {suspiciousIps.length} IP hash
            {suspiciousIps.length === 1 ? "" : "es"} fanned out across
            multiple invitations
          </p>
          <p className="mt-1 opacity-90">
            Per-view IP history is not persisted (by C-1 design — the
            public route only keeps the last hash per invitation). This
            list is a signal, not a verdict. Cross-reference{" "}
            <code className="rounded bg-amber-500/10 px-1 py-0.5">
              audit_log
            </code>{" "}
            for <code>family.invitation.viewed</code> entries before
            acting.
          </p>
          <table className="mt-3 w-full text-[12px]">
            <thead className="text-left">
              <tr>
                <th className="px-2 py-1 font-medium">IP hash (first 16)</th>
                <th className="px-2 py-1 font-medium tabular-nums">
                  Invitations touched
                </th>
                <th className="px-2 py-1 font-medium tabular-nums">
                  Total views
                </th>
              </tr>
            </thead>
            <tbody>
              {suspiciousIps.map(([ipHash, b]) => (
                <tr key={ipHash}>
                  <td className="px-2 py-1 font-mono text-[11px]">
                    {ipHash}
                  </td>
                  <td className="px-2 py-1 tabular-nums">
                    {b.invitations}
                  </td>
                  <td className="px-2 py-1 tabular-nums">{b.totalViews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-lg border">
        <h2 className="border-b bg-muted/40 px-3 py-2 text-[13px] font-medium">
          Recent invitations (50)
        </h2>
        {invitations.length === 0 ? (
          <p className="px-3 py-4 text-muted-foreground">
            No invitations have been issued yet.
          </p>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="border-b bg-muted/30 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Creator</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium tabular-nums">Views</th>
                <th className="px-3 py-2 font-medium">Last view</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invitations.map((row) => {
                const status = lifecycleStatus(row);
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-2">
                      <p className="truncate font-medium">
                        {row.projectName ?? "(unnamed)"}
                      </p>
                      <p className="font-mono text-[10.5px] text-muted-foreground">
                        {row.projectId.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {row.creatorEmail ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmtJst(row.createdAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmtJst(row.expiresAt)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {row.viewCount}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {fmtJst(row.lastViewedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-6 text-[11.5px] leading-relaxed text-muted-foreground">
        Revocation is intentionally NOT exposed here — the per-project
        owner UI on <code>/mypage/family-share</code> is the canonical
        surface and carries the right project-membership context. Use{" "}
        <code className="rounded bg-muted px-1 py-0.5">/admin/audit</code>{" "}
        with a <code>family.invitation.*</code> filter to see the
        lifecycle log.
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
  colSpan = false,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "neutral";
  colSpan?: boolean;
}) {
  const accent =
    tone === "ok"
      ? "text-foreground"
      : tone === "warn"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (colSpan ? "col-span-2 sm:col-span-4" : "")
      }
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-xl tabular-nums ${accent}`}>
        {value.toLocaleString("ja-JP")}
      </p>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: { label: string; tone: "active" | "revoked" | "expired" };
}) {
  const cls =
    status.tone === "active"
      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
      : status.tone === "revoked"
        ? "border-rose-500/40 text-rose-700 dark:text-rose-300"
        : "border-muted-foreground/30 text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}
    >
      {status.label}
    </span>
  );
}
