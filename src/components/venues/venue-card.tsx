import { Star, Sparkles, Layers, Check } from "lucide-react";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import { PhotoCarousel } from "@/components/venues/photo-carousel";
import { HeartButton } from "@/components/venues/heart-button";
import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import { computeCompositeScore } from "@/lib/venue-score";
import { CEREMONY_STYLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { VenueStatus } from "@/generated/prisma/client";

/** Minimal venue shape VenueCard reads — compatible with full Prisma Venue and lean DTOs. */
type VenueWithScores = {
  id: string;
  name: string;
  location: string | null;
  status: VenueStatus;
  photoUrls: string[];
  costMin: number | null;
  costMax: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles?: string[];
  dressBringIn?: string | null;
  sourceUrls?: string[];
  scores: Array<{ dimension: string; score: number | unknown; source: string }>;
  estimates?: Array<{ total: number }>;
};

/** Map known host → human label for the "複数サイト統合" tooltip / suffix. */
function siteLabelFromUrl(u: string): string | null {
  try {
    const h = new URL(u).hostname.toLowerCase();
    if (h === "zexy.net" || h.endsWith(".zexy.net")) return "ゼクシィ";
    if (h === "hana-yume.net" || h.endsWith(".hana-yume.net")) return "ハナユメ";
    if (h === "weddingpark.net" || h.endsWith(".weddingpark.net"))
      return "ウエディングパーク";
    if (h === "wedding.mynavi.jp" || h.endsWith(".mynavi.jp")) return "マイナビ";
    if (h === "mwed.jp" || h.endsWith(".mwed.jp")) return "みんなのウェディング";
    return null;
  } catch {
    return null;
  }
}

interface VenueCardProps {
  venue: VenueWithScores;
  isFavorite?: boolean;
  /**
   * E-2 Fit Reason: AI-generated one-liner like
   * "天井 12m と緑の中庭 — ふたりの『光と緑』に合います".
   * Null or undefined = render no fit line (conditions not set yet, or
   * generation failed). Shown between photo and info block in gold italics.
   */
  fitReason?: string | null;
  /**
   * Multi-select mode props (compare-mode on /candidates):
   * - When `selectMode` is true, the whole card becomes tap-to-toggle
   *   (prefetch link on the name + image is suppressed) and a large
   *   gold checkbox overlay appears in the bottom-right.
   * - Left alone when `selectMode` is false so normal browsing flow
   *   works exactly as before.
   */
  selectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (venueId: string) => void;
}

export function VenueCard({
  venue,
  isFavorite = false,
  fitReason = null,
  selectMode = false,
  isSelected = false,
  onToggleSelect,
}: VenueCardProps) {
  const avgScore = computeCompositeScore(venue.scores);
  const hasCost = venue.costMin || venue.costMax;

  // V1 Visual: hotel-brochure feel — 3:2 photo, larger serif name,
  // metadata · separated, gold eyebrow price, generous radius (24px).
  const priceLabel: string | null = hasCost
    ? venue.costMin && venue.costMax
      ? `${(venue.costMin / 10000).toFixed(0)}〜${(venue.costMax / 10000).toFixed(0)}万円`
      : venue.costMax
        ? `〜${(venue.costMax / 10000).toFixed(0)}万円`
        : venue.costMin
          ? `${(venue.costMin / 10000).toFixed(0)}万円〜`
          : null
    : venue.estimates?.[0]
      ? `¥${(venue.estimates[0].total / 10000).toFixed(0)}万〜`
      : null;

  const capacityLabel: string | null =
    venue.capacityMin || venue.capacityMax
      ? `着席${
          venue.capacityMin && venue.capacityMax
            ? `${venue.capacityMin}〜${venue.capacityMax}名`
            : venue.capacityMax
              ? `〜${venue.capacityMax}名`
              : `${venue.capacityMin}名〜`
        }`
      : null;

  const metaParts = [venue.location, capacityLabel].filter(
    (s): s is string => Boolean(s),
  );

  const isDecided = venue.status === "selected";

  // Aggregation signal — "複数サイトの情報が集まっている" ポジティブサイン
  const sourceLabels = Array.from(
    new Set(
      (venue.sourceUrls ?? [])
        .map(siteLabelFromUrl)
        .filter((s): s is string => Boolean(s)),
    ),
  );
  const isAggregated = sourceLabels.length >= 2;

  const cardWrapperProps = selectMode
    ? {
        role: "checkbox" as const,
        "aria-checked": isSelected,
        tabIndex: 0,
        onClick: () => onToggleSelect?.(venue.id),
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleSelect?.(venue.id);
          }
        },
      }
    : {};

  return (
    <div
      {...cardWrapperProps}
      className={cn(
        "group relative overflow-hidden rounded-[var(--r-lg)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-500 ease-out md:hover:shadow-[var(--shadow-elevated)] md:hover:-translate-y-0.5 active:scale-[0.98] active:duration-100",
        selectMode && "cursor-pointer",
        selectMode && isSelected && "ring-2 ring-[var(--gold-warm)] ring-offset-2 ring-offset-background",
      )}
      style={
        isDecided && !selectMode
          ? {
              boxShadow:
                "0 0 0 2px color-mix(in oklab, var(--gold-warm) 55%, transparent), 0 1px 3px rgba(42,35,32,0.04), 0 12px 28px color-mix(in oklab, var(--gold-warm) 14%, transparent)",
            }
          : undefined
      }
    >
      {/* Photo section — 4:3 editorial ratio, gold hairline below.
          In select mode the whole card is the tap target, so the photo
          becomes a plain <div> rather than a PrefetchLink. */}
      <div className="relative border-b border-[var(--gold-subtle)]/40">
        {selectMode ? (
          <div aria-hidden="true">
            <PhotoCarousel
              photos={venue.photoUrls}
              alt={venue.name}
              aspectRatio="4/3"
            />
            {venue.photoUrls.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
            )}
          </div>
        ) : (
          <PrefetchLink href={`/venues/${venue.id}`}>
            <PhotoCarousel
              photos={venue.photoUrls}
              alt={venue.name}
              aspectRatio="4/3"
            />
            {venue.photoUrls.length > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
            )}
          </PrefetchLink>
        )}

        {/* Heart button - top right only. Hidden in select mode (the whole
            card is the tap target; hearting would swallow the toggle). */}
        {!selectMode && (
          <div className="absolute right-3 top-3 z-10">
            <HeartButton venueId={venue.id} initialFavorite={isFavorite} />
          </div>
        )}

        {/* Selection checkbox — bottom right so it doesn't collide with
            the heart (top right). Large tap target, gold when selected. */}
        {selectMode && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute bottom-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
              isSelected
                ? "border-[var(--gold-warm)] bg-[var(--gold-warm)] text-background"
                : "border-background/80 bg-background/60 text-transparent backdrop-blur-sm",
            )}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
        )}

        {/* "晴れの日" chip — decided venue only, top left */}
        {isDecided && (
          <div
            aria-label="決まった場所"
            className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[0.12em] uppercase text-white backdrop-blur-sm"
            style={{
              background:
                "color-mix(in oklab, var(--gold-warm) 85%, transparent)",
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.15), 0 6px 16px color-mix(in oklab, var(--gold-warm) 30%, transparent)",
            }}
          >
            晴れの日
          </div>
        )}
      </div>

      {/* Meta bar — status + score horizontal strip below photo */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <VenueStatusBadge status={venue.status} />
        {isAggregated && (
          <span
            aria-label={`${sourceLabels.slice(0, 2).join("・")} から情報を統合済み`}
            title={`${sourceLabels.join("・")} から情報を統合しています`}
            className="inline-flex items-center gap-1 rounded-full bg-primary/5 text-primary px-2 py-0.5 text-[10.5px] tracking-[0.04em]"
            style={{
              border:
                "1px solid color-mix(in oklab, var(--primary) 30%, transparent)",
            }}
          >
            <Layers className="h-3 w-3" strokeWidth={2} />
            複数サイト統合
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          {priceLabel && (
            <p className="tabular-nums text-eyebrow text-[var(--gold-warm)]">
              {priceLabel}
            </p>
          )}
          {avgScore !== null && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-[var(--gold-warm)] text-[var(--gold-warm)]" strokeWidth={0} />
              <span className="tabular-nums text-[13px] font-normal text-foreground">
                {avgScore.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* E-2 Fit Reason — AI 1-line match reason (optional, gold italic) */}
      {fitReason && (
        <p
          aria-label="AI による相性コメント"
          className="flex items-start gap-2 px-6 pt-5 text-[13px] leading-relaxed font-light italic tracking-[0.01em] text-[var(--gold-warm)]"
        >
          <Sparkles
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={1.6}
          />
          <span>{fitReason}</span>
        </p>
      )}

      {/* Info section — generous padding, hotel-brochure typography.
          In select mode the wrapping <div> already handles tap; we
          swap the link out for a plain <div> to avoid nested tap targets. */}
      {selectMode ? (
        <div className="block px-4 pt-2 pb-5">
          <h3 className="truncate text-h2 font-[family-name:var(--font-display)] font-light tracking-[-0.01em]">
            {venue.name}
          </h3>
          {metaParts.length > 0 && (
            <p className="mt-2 truncate text-meta text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          )}
          {((venue.ceremonyStyles?.length ?? 0) > 0 || venue.dressBringIn) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(venue.ceremonyStyles ?? []).map((style) => (
                <span
                  key={style}
                  className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground"
                >
                  {CEREMONY_STYLE_LABELS[style.toLowerCase()] ?? style}
                </span>
              ))}
              {venue.dressBringIn && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground">
                  持ち込み{venue.dressBringIn === "allowed" ? "可" : venue.dressBringIn === "not_allowed" ? "不可" : "要相談"}
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <PrefetchLink href={`/venues/${venue.id}`} className="block px-4 pt-2 pb-5">
          <h3 className="truncate text-h2 font-[family-name:var(--font-display)] font-light tracking-[-0.01em]">
            {venue.name}
          </h3>
          {metaParts.length > 0 && (
            <p className="mt-2 truncate text-meta text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          )}
          {((venue.ceremonyStyles?.length ?? 0) > 0 || venue.dressBringIn) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(venue.ceremonyStyles ?? []).map((style) => (
                <span
                  key={style}
                  className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground"
                >
                  {CEREMONY_STYLE_LABELS[style.toLowerCase()] ?? style}
                </span>
              ))}
              {venue.dressBringIn && (
                <span className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground">
                  持ち込み{venue.dressBringIn === "allowed" ? "可" : venue.dressBringIn === "not_allowed" ? "不可" : "要相談"}
                </span>
              )}
            </div>
          )}
        </PrefetchLink>
      )}
    </div>
  );
}
