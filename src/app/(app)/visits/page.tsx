import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, CheckCircle2, MapPin } from "lucide-react";
import { getUpcomingVisits, getPastVisits } from "@/server/actions/visits";
import { VisitMonthCalendar } from "@/components/visits/visit-month-calendar";
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

      {/* Empty state */}
      {!hasAny && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/60 px-6 py-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-[15px] font-light text-foreground">見学予定はまだありません</p>
            <p className="mt-1 text-[13px] text-muted-foreground">式場を探してみましょう</p>
          </div>
          <Link
            href="/explore"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-[14px] font-medium text-primary-foreground transition-colors active:scale-[0.98]"
          >
            式場をさがす
          </Link>
        </div>
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
              <Link
                key={v.id}
                href={`/venues/${v.venueId}#visit`}
                className="flex min-h-[72px] items-start gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 active:scale-[0.98] active:bg-muted transition-transform"
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
                <div className="min-w-0 flex-1">
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
            ))}
          </div>
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
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
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
