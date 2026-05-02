import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/admin";
import { recordAudit } from "@/server/audit";

/**
 * /admin/feedback — Beta inbox view (audit-driven, no separate table).
 *
 * The /mypage/feedback form's server action records two things:
 *   1. an audit row with `action="user.feedback.submitted"` and a
 *      detail JSON `{subject, bodyLength, hasContact}`
 *   2. an email to FEEDBACK_EMAIL with the full body
 *
 * The email is the operator's working surface (reply, triage, archive).
 * This page is just the **inbox index** — it lists who submitted what
 * subject when, so the operator can correlate Sentry / a support
 * ticket / a feedback message without scrolling through their inbox.
 *
 * Body content is intentionally NOT rendered here — it's PII the user
 * typed for the operator's eyes only, and audit_logs is the wrong
 * table to store free-form prose. Read the email for the actual text.
 *
 * Auth: `requireAdmin()` (404 for non-admins — see `src/server/admin.ts`).
 */

export const metadata = {
  title: "Beta Feedback Inbox",
  robots: { index: false, follow: false },
};

interface SearchParams {
  since?: string;
  limit?: string;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;

function parseLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseSince(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00Z`)
    : new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmtDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

interface FeedbackDetail {
  subject?: string;
  bodyLength?: number;
  hasContact?: boolean;
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;

  await recordAudit({
    action: "admin.feedback.viewed",
    actorId: admin.userId,
    actorRole: "admin",
    detail: { since: params.since ?? null, limit: params.limit ?? null },
  });

  const limit = parseLimit(params.limit);
  const since = parseSince(params.since);

  const where: Record<string, unknown> = { action: "user.feedback.submitted" };
  if (since) where.createdAt = { gte: since };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      actorId: true,
      createdAt: true,
      detail: true,
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-sm">
      <header className="mb-6">
        <h1 className="text-xl font-medium">Beta Feedback Inbox</h1>
        <p className="mt-1 text-muted-foreground">
          Source:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">audit_logs</code>{" "}
          where{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            action = &quot;user.feedback.submitted&quot;
          </code>
          . Body content lives in the operator email inbox (see{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">
            FEEDBACK_EMAIL
          </code>
          ); this view is the index for triage, NOT a reading surface.
        </p>
        <p className="mt-1 text-muted-foreground">
          Showing <strong>{rows.length}</strong> rows
          {since ? ` since ${since.toISOString().slice(0, 10)}` : ""}.
        </p>
      </header>

      <section className="mb-6">
        <form method="get" className="flex flex-wrap gap-3 text-xs">
          <label className="flex flex-col gap-1">
            since
            <input
              type="text"
              name="since"
              defaultValue={params.since ?? ""}
              placeholder="2026-05-01"
              className="rounded border px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1">
            limit
            <input
              type="number"
              name="limit"
              min={1}
              max={MAX_LIMIT}
              defaultValue={String(limit)}
              className="w-20 rounded border px-2 py-1 font-mono"
            />
          </label>
          <button
            type="submit"
            className="self-end rounded bg-primary px-3 py-1 text-primary-foreground"
          >
            Apply
          </button>
        </form>
      </section>

      <section>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 font-medium">Time (UTC)</th>
                <th className="px-3 py-2 font-medium">Actor (user id)</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 text-right font-medium">Body chars</th>
                <th className="px-3 py-2 text-center font-medium">Reply?</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    まだ feedback はありません。
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const detail = (r.detail ?? {}) as FeedbackDetail;
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-3 py-2 font-mono">
                        {fmtDate(r.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <span
                          className="block max-w-[14ch] truncate"
                          title={r.actorId}
                        >
                          {r.actorId}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="block max-w-[36ch] truncate" title={detail.subject ?? ""}>
                          {detail.subject ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {detail.bodyLength ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {detail.hasContact ? "✓" : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-8 text-xs text-muted-foreground">
        Helper:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          src/server/actions/feedback.ts
        </code>{" "}
        · Form:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          /mypage/feedback
        </code>{" "}
        · Audit verb:{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          user.feedback.submitted
        </code>
      </footer>
    </main>
  );
}
