"use client";

import { useMemo, useTransition } from "react";
import { Clock, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshVenueFromSource } from "@/server/actions/venues";
import { formatRelativeJa, venueFreshness } from "@/lib/utils";

interface Props {
  venueId: string;
  /** Prisma updatedAt (ISO string after serialization across RSC boundary). */
  updatedAt: string | Date;
  /** Only venues imported from an external URL can be refreshed. */
  hasSourceUrl: boolean;
}

/**
 * Freshness chip for the venue detail page. Surfaces two signals couples
 * otherwise couldn't see:
 *
 *   1. When was this venue's imported info last written?
 *   2. Is it old enough to potentially be stale (>= 30d)?
 *
 * When the venue was imported from a source URL, the chip doubles as
 * the refresh trigger — tapping re-runs the import pipeline and toasts
 * a summary. Venues added manually (no sourceUrls) show an
 * informational chip only.
 *
 * Staleness threshold (30d) and copy align with the audit plan: the
 * wedding industry refreshes pricing monthly so venues past that window
 * have a meaningful chance of showing out-of-date numbers.
 */
export function VenueFreshnessChip({ venueId, updatedAt, hasSourceUrl }: Props) {
  const [pending, start] = useTransition();
  const router = useRouter();

  // Memoize the freshness calc so re-renders don't reclassify on every
  // interaction. The inputs (updatedAt) only change when the page
  // re-fetches after a refresh.
  const { state, daysOld, label } = useMemo(() => {
    const then =
      typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
    const { state, daysOld } = venueFreshness(then);
    return { state, daysOld, label: formatRelativeJa(then) };
  }, [updatedAt]);

  const isStale = state === "stale";

  // Color / border tokens:
  //   fresh  → muted neutral chip (doesn't shout, just informs)
  //   stale  → gold-warm outlined chip (caution, not alarm — red would
  //            overstate the risk and clash with decision CTAs below)
  const chipClass = isStale
    ? "border-[color:var(--gold-warm)]/70 bg-[color:var(--gold-warm)]/10 text-[color:var(--gold-warm)]"
    : "border-border bg-card text-muted-foreground";

  const Icon = isStale ? AlertTriangle : Clock;

  // Copy strategy:
  //   fresh   → "N日前に更新"
  //   stale   → "情報が古い可能性 · N日前"
  // Manual-add venues have no source URL → they still show freshness
  // but can't be refreshed, so the CTA disappears.
  const leadText = isStale ? `情報が古い可能性 · ${label}` : `${label}に更新`;

  const onRefresh = () => {
    if (!hasSourceUrl || pending) return;
    start(async () => {
      try {
        const result = await refreshVenueFromSource(venueId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        const { updatedFields, photoAddedCount } = result;
        if (updatedFields.length === 0 && photoAddedCount === 0) {
          toast.info("最新情報と変わりませんでした");
        } else {
          const parts: string[] = [];
          if (updatedFields.length > 0) {
            parts.push(`${updatedFields.length}項目を更新`);
          }
          if (photoAddedCount > 0) {
            parts.push(`写真 ${photoAddedCount} 枚を追加`);
          }
          toast.success(parts.join(" / "));
        }
        router.refresh();
      } catch {
        toast.error(
          "式場の情報サイトにつながりませんでした。しばらくしてからもう一度",
        );
      }
    });
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label={
        isStale
          ? `登録情報が ${daysOld} 日前のため古い可能性があります`
          : `登録情報は ${label}に更新されました`
      }
    >
      {/* Freshness chip — non-interactive, informational. Tiny so it
          doesn't compete with the venue name above. */}
      <span
        className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] leading-none transition-colors ${chipClass}`}
      >
        <Icon className="h-3 w-3 shrink-0" strokeWidth={1.6} aria-hidden="true" />
        <span className="tabular-nums">{leadText}</span>
      </span>

      {/* Refresh trigger — appears only when this venue was imported
          from an external URL. Manual-add venues can't be refreshed. */}
      {hasSourceUrl && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card px-2.5 text-[11px] leading-none text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-foreground/30 active:scale-95 disabled:opacity-60"
          aria-label="登録元のページから最新情報を取り込む"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden="true" strokeWidth={1.6} />
          )}
          {pending ? "更新中…" : "最新に更新"}
        </button>
      )}
    </div>
  );
}
