"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarVisit {
  id: string;
  venueId: string;
  venueName: string;
  scheduledAt: Date | null;
  status: string;
}

interface VisitMonthCalendarProps {
  visits: CalendarVisit[];
  initialMonth: Date;
}

// Stable palette — cycles when more venues than colors
const DOT_COLORS = [
  "bg-[var(--gold-warm)]",
  "bg-blue-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-violet-400",
];

function toJSTDate(date: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === "year")!.value, 10),
    month: parseInt(parts.find(p => p.type === "month")!.value, 10) - 1,
    day: parseInt(parts.find(p => p.type === "day")!.value, 10),
  };
}

function jstMonthStart(year: number, month: number): Date {
  // Return midnight JST for the 1st of the given month
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+09:00`;
  return new Date(iso);
}

export function VisitMonthCalendar({ visits, initialMonth }: VisitMonthCalendarProps) {
  const initJst = toJSTDate(initialMonth);
  const [year, setYear] = useState(initJst.year);
  const [month, setMonth] = useState(initJst.month); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Assign stable color index per venueId
  const venueColorMap = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const v of visits) {
      if (!map.has(v.venueId)) {
        map.set(v.venueId, idx % DOT_COLORS.length);
        idx++;
      }
    }
    return map;
  }, [visits]);

  // Map day -> visits for this month
  const visitsByDay = useMemo(() => {
    const map = new Map<number, CalendarVisit[]>();
    for (const v of visits) {
      if (!v.scheduledAt) continue;
      const jst = toJSTDate(v.scheduledAt);
      if (jst.year === year && jst.month === month) {
        const arr = map.get(jst.day) ?? [];
        arr.push(v);
        map.set(jst.day, arr);
      }
    }
    return map;
  }, [visits, year, month]);

  // Build 6-row × 7-col grid (Sunday-start)
  const cells = useMemo(() => {
    const firstDay = jstMonthStart(year, month);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    while (grid.length < 42) grid.push(null);
    return grid;
  }, [year, month]);

  const today = toJSTDate(new Date());
  const isCurrentMonth = today.year === year && today.month === month;

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const monthLabel = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" })
    .format(new Date(year, month, 1));

  const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

  const selectedVisits = selectedDay !== null ? (visitsByDay.get(selectedDay) ?? []) : [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          aria-label="前の月"
          onClick={prevMonth}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors active:bg-muted hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="font-[family-name:var(--font-display)] text-[18px] font-light text-foreground">
          {monthLabel}
        </h2>
        <button
          aria-label="次の月"
          onClick={nextMonth}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors active:bg-muted hover:bg-muted"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "py-1 text-center text-[11px] font-medium tracking-wide text-muted-foreground",
              i === 0 && "text-rose-400",
              i === 6 && "text-blue-400",
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          const isToday = isCurrentMonth && day === today.day;
          const hasVisits = day !== null && visitsByDay.has(day);
          const isSelected = day === selectedDay;
          const dayVisits = day !== null ? (visitsByDay.get(day) ?? []) : [];

          return (
            <button
              key={i}
              disabled={day === null || !hasVisits}
              onClick={() => {
                if (day === null) return;
                setSelectedDay(prev => (prev === day ? null : day));
              }}
              aria-label={day !== null ? `${month + 1}月${day}日` : undefined}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-start pt-1.5 rounded-xl transition-colors",
                day === null && "pointer-events-none",
                hasVisits && !isSelected && "active:bg-muted hover:bg-muted/50",
                isSelected && "bg-[var(--gold-subtle)]",
              )}
            >
              {day !== null && (
                <>
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[13px] tabular-nums",
                      isToday && "border border-[var(--gold-warm)] text-[var(--gold-warm)]",
                      !isToday && "text-foreground",
                    )}
                  >
                    {day}
                  </span>
                  {dayVisits.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap justify-center gap-[2px]">
                      {dayVisits.slice(0, 3).map(v => (
                        <span
                          key={v.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            DOT_COLORS[venueColorMap.get(v.venueId) ?? 0],
                          )}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay !== null && selectedVisits.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
          <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground">
            {month + 1}月{selectedDay}日の見学
          </p>
          {selectedVisits.map(v => (
            <a
              key={v.id}
              href={`/venues/${v.venueId}#visit`}
              className="flex min-h-11 items-center gap-3 rounded-xl border border-border/40 bg-card-elevated px-3 py-2 active:scale-[0.98] transition-transform"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  DOT_COLORS[venueColorMap.get(v.venueId) ?? 0],
                )}
              />
              <span className="font-[family-name:var(--font-display)] text-[14px] font-light text-foreground line-clamp-1">
                {v.venueName}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
