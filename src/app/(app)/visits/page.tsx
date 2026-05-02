import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, CalendarDays, CalendarPlus, CheckCircle2, MapPin } from "lucide-react";
import { getUpcomingVisits, getPastVisits } from "@/server/actions/visits";
import { VisitMonthCalendar } from "@/components/visits/visit-month-calendar";
import { CalendarExportButton } from "@/components/visits/calendar-export-button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "見学カレンダー",
  description: "見学予定と過去の見学記録を一覧で確認できます。",
};

function formatJST(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...opts }).format(date);
}

export default async function VisitsPage() {
  const [upcoming, past] = await Promise.all([getUpcomingVisits(), getPastVisits()]);

  // Merge for calendar (upcoming only — past visits don't show on calendar)
  const calendarVisits = upcoming.map(v => ({
    id: v.id,
    venueId: v.venueId,
    venueName: v.venueName,
    scheduledAt: v.scheduledAt,
    status: v.status,
  }));

  const hasAny = upcoming.length > 0 || past.length > 0;

  return (
    <div className="space-y-8 pb-8">
      {/* Page title */}
      <div>
        <p className="mb-0.5 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
          Schedule
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-light text-foreground">
          見学カレンダー
        </h1>
      </div>

      {/* Empty state — D1-2 (Phase 3 商用化準備). Replaced the bespoke
          dashed card with the shared <EmptyState> so the 4 surfaces in
          this audit (decision / visits / checklist / journey) all read
          the same gold-sparkle empty grammar. CTA points to /candidates
          per spec — couples land on visits expecting "where do I plan
          a visit from?" and the answer is the candidates list, not
          the explore browse. */}
      {!hasAny && (
        <EmptyState
          icon={CalendarDays}
          title="見学を入れたら、ここに記録が残ります"
          description="当日のメモ・写真・帰り道の感想まで、後で見返せる場所です。まずは候補から見学日を決めてみてください。"
          action={{ label: "候補から見学を入れる", href: "/candidates" }}
        />
      )}

      {/* Calendar — show if any upcoming */}
      {upcoming.length > 0 && (
        <section aria-labelledby="calendar-heading">
          <h2 id="calendar-heading" className="sr-only">月次カレンダー</h2>
          <VisitMonthCalendar
            visits={calendarVisits}
            initialMonth={new Date()}
          />
        </section>
      )}

      {/* Upcoming visits */}
      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2
            id="upcoming-heading"
            className="mb-3 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground"
          >
            Upcoming
          </h2>
          <div className="space-y-2">
            {upcoming.map(v => (
              // F2 (W15 audit): wrap the tappable card + export button in a
              // relative container so the button can anchor to the row end
              // without nesting <button> inside <a> (accessibility violation).
              <div key={v.id} className="relative">
                <Link
                  href={`/venues/${v.venueId}#visit`}
                  className="flex min-h-[72px] items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 pr-3 active:scale-[0.98] active:bg-muted transition-transform"
                >
                  {/* Date block */}
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-[var(--gold-subtle)] py-1.5">
                    {v.scheduledAt ? (
                      <>
                        <span className="text-[10px] font-medium tracking-widest text-[var(--gold-warm)]">
                          {formatJST(v.scheduledAt, { month: "short" }).toUpperCase()}
                        </span>
                        <span className="font-[family-name:var(--font-display)] text-[22px] font-light tabular-nums text-[var(--gold-warm)] leading-none">
                          {formatJST(v.scheduledAt, { day: "numeric" })}
                        </span>
                      </>
                    ) : (
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1 pr-24">
                    <p className="font-[family-name:var(--font-display)] text-[15px] font-light text-foreground line-clamp-1">
                      {v.venueName}
                    </p>
                    {v.scheduledAt && (
                      <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                        {formatJST(v.scheduledAt, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {v.venueLocation && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="line-clamp-1">{v.venueLocation}</span>
                      </p>
                    )}
                    {v.checklistProgress.total > 0 && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--gold-warm)] transition-[width]"
                            style={{ width: `${Math.round((v.checklistProgress.checked / v.checklistProgress.total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground whitespace-nowrap">
                          {v.checklistProgress.checked}/{v.checklistProgress.total}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
                {/* F2 (W15 audit): second exposure — row-end action. See design §3.2.2. */}
                <div className="absolute right-3 bottom-3">
                  <CalendarExportButton
                    visitId={v.id}
                    venueName={v.venueName}
                    calendarExportedAt={v.calendarExportedAt}
                    visitStatus={v.status}
                    variant="compact"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* F2: bulk export — only surface when there are 2+ scheduled visits.
              Matches design §4.4 "複数 visit の一括エクスポート". */}
          {upcoming.length >= 2 && (
            <div className="mt-4 flex justify-center">
              <a
                href="/api/projects/current/visits.ics"
                download="haretoki-visits.ics"
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-medium",
                  "bg-[var(--gold-subtle)] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))]",
                  "transition-all duration-150 active:scale-[0.98]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)]/60",
                )}
              >
                <CalendarPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                ふたりのカレンダーを まとめて 持ち出す
              </a>
            </div>
          )}
        </section>
      )}

      {/* Past visits */}
      {past.length > 0 && (
        <section aria-labelledby="past-heading">
          <h2
            id="past-heading"
            className="mb-3 text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground"
          >
            Past
          </h2>
          <div className="space-y-2">
            {past.map(v => (
              <Link
                key={v.id}
                href={`/venues/${v.venueId}#visit`}
                className="flex min-h-[64px] items-start gap-3 rounded-2xl border border-border/40 bg-card px-4 py-3 active:scale-[0.98] active:bg-muted transition-transform"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-warm)]" />
                <div className="min-w-0 flex-1">
                  <p className="font-[family-name:var(--font-display)] text-[15px] font-light text-foreground line-clamp-1">
                    {v.venueName}
                  </p>
                  {v.completedAt && (
                    <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                      {formatJST(v.completedAt, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  )}
                  {v.memo && (
                    <p className="mt-1 text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {v.memo}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    v.checklistProgress.total > 0 && v.checklistProgress.checked === v.checklistProgress.total
                      ? "bg-tint-success text-tone-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {v.checklistProgress.total > 0
                    ? `${v.checklistProgress.checked}/${v.checklistProgress.total}`
                    : "完了"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
