"use client";

/**
 * F2 (W15 audit) — "カレンダーに追加" button.
 *
 * Design: docs/designs/f2-visit-calendar-ics.md §3 & §5
 *
 * State matrix (§3.1):
 *   未登録          → parent should not render this (visit === null)
 *   未エクスポート   → gold-subtle tertiary, label "カレンダーに追加"
 *   エクスポート済み → ghost tertiary, label "もう一度 送る" + Check icon
 *   exporting       → subtle pulse + CalendarPlus icon
 *   error           → toast失敗 + state reset
 *
 * Download mechanism: we `fetch` the .ics endpoint (not a bare <a download>)
 * so that we can (a) detect success to fire `markVisitCalendarExported`,
 * and (b) show a progress state. For iOS Safari, Blob URL + a.click() still
 * triggers the native "Add Event?" sheet the same way.
 */
import { useState, useTransition } from "react";
import { Calendar, CalendarPlus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { markVisitCalendarExported } from "@/server/actions/visits";
import { useRouter } from "next/navigation";

export interface CalendarExportButtonProps {
    visitId: string;
    venueName: string;
    /** null = never exported; Date = last successful download timestamp. */
    calendarExportedAt: Date | string | null;
    /** Visit status — "cancelled" / "completed" hide the button upstream. */
    visitStatus: "scheduled" | "completed" | "cancelled" | string;
    /** Visual density. `inline` = tall (44px) for /visits rows; `compact` for in-card. */
    variant?: "inline" | "compact";
    /** Optional className override for position-specific tweaks. */
    className?: string;
}

export function CalendarExportButton({
    visitId,
    venueName,
    calendarExportedAt,
    visitStatus,
    variant = "inline",
    className,
}: CalendarExportButtonProps) {
    const router = useRouter();
    const [isExporting, setIsExporting] = useState(false);
    const [, startTransition] = useTransition();

    // Don't render for non-scheduled visits (completed / cancelled handled by parent).
    if (visitStatus !== "scheduled") return null;

    const hasExported = calendarExportedAt !== null;

    const handleClick = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const res = await fetch(`/api/visits/${visitId}/ics`, {
                method: "GET",
                credentials: "include",
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            // Derive filename from Content-Disposition when present; otherwise
            // fall back to a sane default.
            let filename = "haretoki-visit.ics";
            const cd = res.headers.get("Content-Disposition");
            if (cd) {
                const m = cd.match(/filename="([^"]+)"/);
                if (m) filename = m[1];
            }

            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Revoke after the tap handler has a chance to dispatch the
            // native OS flow (Safari occasionally aborts too-early revokes).
            setTimeout(() => URL.revokeObjectURL(url), 10_000);

            // Persist "user exported" after the download stream resolved.
            startTransition(async () => {
                const result = await markVisitCalendarExported(visitId);
                if (!result.success) {
                    // Don't block success toast — the download worked; the
                    // metric column update is best-effort.
                    console.warn(
                        "markVisitCalendarExported failed",
                        result.error,
                    );
                }
                router.refresh();
            });

            toast.success("ふたりのカレンダーに入りました", {
                description: hasExported
                    ? `${venueName} を もう一度 送りました`
                    : "次の画面で「追加」を押してください",
                duration: 6000,
            });
        } catch (err) {
            console.error("calendar export failed", err);
            toast.error("うまく渡せませんでした。また試してみてください");
        } finally {
            setIsExporting(false);
        }
    };

    const Icon = isExporting
        ? Loader2
        : hasExported
          ? Calendar
          : CalendarPlus;
    const label = hasExported ? "もう一度 送る" : "カレンダーに追加";

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isExporting}
            aria-label={`${venueName} の見学をカレンダーに追加`}
            className={cn(
                // tertiary (gold-subtle) baseline — see §5.1
                "inline-flex items-center justify-center gap-1.5 rounded-xl",
                "text-[13px] font-medium tabular-nums",
                "transition-all duration-150 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)]/60",
                "disabled:opacity-70",
                variant === "inline"
                    ? "h-11 px-3"
                    : "h-9 px-2.5 text-[12px]",
                hasExported
                    ? "bg-transparent text-muted-foreground hover:text-foreground"
                    : "bg-[var(--gold-subtle)] text-[color-mix(in_oklab,var(--gold-warm)_80%,var(--foreground))] hover:bg-[color-mix(in_oklab,var(--gold-warm)_14%,var(--card))]",
                isExporting && "animate-pulse",
                className,
            )}
        >
            <Icon
                className={cn(
                    variant === "inline" ? "h-4 w-4" : "h-3.5 w-3.5",
                    isExporting && "animate-spin",
                )}
                strokeWidth={1.5}
                aria-hidden="true"
            />
            <span>{label}</span>
            {hasExported && !isExporting && (
                <Check
                    className={cn(
                        variant === "inline" ? "h-3.5 w-3.5" : "h-3 w-3",
                        "text-[var(--gold-warm)]",
                    )}
                    strokeWidth={2}
                    aria-hidden="true"
                />
            )}
        </button>
    );
}
