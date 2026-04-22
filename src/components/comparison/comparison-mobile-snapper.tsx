"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeCompositeScore } from "@/lib/venue-score";
import {
  computeWeightedComposite,
  type DimensionWeights,
} from "@/lib/weighted-score";
import type {
  ComparisonMatrix,
  ComparisonVenue,
} from "@/lib/comparison-types";
import {
  COMPARE_FIELDS,
  FIELD_GROUP_LABELS,
  resolveHighlight,
  type CompareField,
  type FieldGroup,
} from "./comparison-field-registry";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";

/**
 * Mobile-first view for /compare (<768px).
 *
 * At 375px viewport, a 10-column horizontal grid (1760px wide) is
 * unusable — you can only see 2 columns at a time. Instead this
 * component gives each venue its own full-width "card" and uses
 * scroll-snap-x-mandatory so one flick = one venue.
 *
 * Each venue card renders the SAME rows as the desktop grid (field
 * registry + checklist items), but stacked top-to-bottom within the
 * card rather than side-by-side. Highlight markers still use the shared
 * resolveHighlight so "best price" stays visually consistent across
 * the same venue in both views.
 *
 * A sticky "3 / 10" indicator at the top tells the user where they are
 * in the stack. Updated via IntersectionObserver on each card.
 */

interface Props {
  matrix: ComparisonMatrix;
  /** W12-1: viewer's dimension weights; null → unweighted (legacy). */
  weights?: DimensionWeights | null;
}

export function ComparisonMobileSnapper({ matrix, weights = null }: Props) {
  const { venues, items, answers } = matrix;
  const [active, setActive] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    cardRefs.current = cardRefs.current.slice(0, venues.length);
  }, [venues.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = cardRefs.current.findIndex((el) => el === entry.target);
            if (idx !== -1) setActive(idx);
          }
        }
      },
      { root: scroller, threshold: [0.6] },
    );
    for (const el of cardRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [venues.length]);

  const scrollTo = useCallback((idx: number) => {
    const card = cardRefs.current[idx];
    if (card) card.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, []);

  // Pre-compute highlight sets per field (once, not per card render)
  const fieldWinners = new Map<string, Set<string>>();
  for (const f of COMPARE_FIELDS) {
    fieldWinners.set(f.id, resolveHighlight(f, venues));
  }

  const visibleFields = COMPARE_FIELDS.filter((f) =>
    venues.some((v) => f.hasValue(f.accessor(v))),
  );
  const fieldsByGroup = new Map<FieldGroup, CompareField[]>();
  for (const f of visibleFields) {
    if (!fieldsByGroup.has(f.group)) fieldsByGroup.set(f.group, []);
    fieldsByGroup.get(f.group)!.push(f);
  }

  const checklistGroups = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="relative">
      {/* Sticky indicator — "3 / 10" + dot jumper */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-4 py-2.5 backdrop-blur-sm">
        <span className="tabular-nums text-[12px] text-muted-foreground">
          {active + 1} / {venues.length}
        </span>
        <div className="flex items-center gap-1.5">
          {venues.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`${i + 1} 件目: ${v.name}`}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === active
                  ? "bg-[var(--gold-warm)] w-4"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="-mx-4 flex overflow-x-auto px-4 pb-8"
        style={{
          scrollSnapType: "x mandatory",
          scrollPaddingLeft: "16px",
        }}
      >
        {venues.map((venue, venueIdx) => (
          <div
            key={venue.id}
            ref={(el) => {
              cardRefs.current[venueIdx] = el;
            }}
            style={{ scrollSnapAlign: "start" }}
            className="mr-3 w-[calc(100vw-32px)] shrink-0 last:mr-0"
          >
            <VenueCardView
              venue={venue}
              answers={answers}
              visibleFields={visibleFields}
              fieldsByGroup={fieldsByGroup}
              fieldWinners={fieldWinners}
              checklistGroups={checklistGroups}
              weights={weights}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueCardView({
  venue,
  answers,
  visibleFields,
  fieldsByGroup,
  fieldWinners,
  checklistGroups,
  weights,
}: {
  venue: ComparisonVenue;
  answers: ComparisonMatrix["answers"];
  visibleFields: CompareField[];
  fieldsByGroup: Map<FieldGroup, CompareField[]>;
  fieldWinners: Map<string, Set<string>>;
  checklistGroups: Array<{ category: string; label: string; items: ComparisonMatrix["items"] }>;
  weights?: DimensionWeights | null;
}) {
  // W12-1: prefer weighted composite when viewer has set weights. Falls
  // back to the unweighted composite for couples who haven't adjusted a
  // single slider — so their compare screen stays bit-identical.
  const composite = weights
    ? computeWeightedComposite(
        venue.scores.map((s) => ({
          dimension: s.dimension,
          score: s.score,
          source: s.source,
        })),
        weights,
      )
    : computeCompositeScore(venue.scores);
  const rating = composite ?? venue.externalRatingValue;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-[var(--shadow-card)]">
      {/* Header — photo 4:3 + name + rating */}
      <Link href={`/venues/${venue.id}`} className="block">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {venue.photoUrls[0] ? (
            <Image
              src={venue.photoUrls[0]}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              unoptimized
            />
          ) : null}
          {rating !== null && (
            <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] text-[var(--gold-warm)] backdrop-blur-sm">
              <Star className="h-3 w-3 fill-current" strokeWidth={0} />
              <span className="tabular-nums font-medium">{rating.toFixed(1)}</span>
              {venue.externalReviewCount !== null && venue.externalReviewCount > 0 && (
                <span className="tabular-nums text-muted-foreground">
                  ({venue.externalReviewCount.toLocaleString("ja-JP")})
                </span>
              )}
            </div>
          )}
        </div>
        <div className="px-4 py-3">
          <h3 className="font-[family-name:var(--font-display)] text-[17px] font-light leading-tight tracking-[-0.01em]">
            {venue.name}
          </h3>
          {venue.location && (
            <p className="mt-1 text-[12px] text-muted-foreground">{venue.location}</p>
          )}
        </div>
      </Link>

      {/* Deep Extraction rows — stacked dl */}
      <dl className="divide-y divide-border/30 border-t border-border/30 text-[12.5px]">
        {Array.from(fieldsByGroup.entries()).map(([group, fields]) => (
          <div key={group} className="bg-background">
            {/* Group subheading */}
            <div className="bg-[color-mix(in_oklab,var(--gold-warm)_4%,var(--background))] px-4 py-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--gold-warm)]">
                {FIELD_GROUP_LABELS[group]}
              </span>
            </div>
            {fields.map((f) => (
              <FieldRowMobile
                key={f.id}
                field={f}
                venue={venue}
                isWinner={fieldWinners.get(f.id)?.has(venue.id) ?? false}
              />
            ))}
          </div>
        ))}

        {checklistGroups.length > 0 && visibleFields.length > 0 && (
          <div className="h-2 bg-background" />
        )}

        {checklistGroups.map((g) => (
          <div key={g.category} className="bg-background">
            <div className="bg-muted/40 px-4 py-1.5">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                チェックリスト · {g.label}
              </span>
            </div>
            {g.items.map((item) => (
              <ChecklistRowMobile
                key={item.id}
                item={item}
                venueId={venue.id}
                answers={answers}
              />
            ))}
          </div>
        ))}
      </dl>
    </div>
  );
}

function FieldRowMobile({
  field,
  venue,
  isWinner,
}: {
  field: CompareField;
  venue: ComparisonVenue;
  isWinner: boolean;
}) {
  const raw = field.accessor(venue);
  const hasValue = field.hasValue(raw);

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-2.5",
        isWinner && "bg-[color-mix(in_oklab,var(--gold-warm)_5%,transparent)]",
      )}
    >
      <dt className="w-24 shrink-0 text-[11px] text-muted-foreground">
        {field.label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-start gap-1">
        {isWinner && field.highlight.kind === "best" && (
          <Crown
            aria-label="最良"
            className="mt-0.5 h-3 w-3 shrink-0 text-[var(--gold-warm)]"
            strokeWidth={2}
          />
        )}
        <div className="min-w-0 flex-1">
          {hasValue ? (
            <MobileCellRender field={field} raw={raw} isWinner={isWinner} />
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </div>
      </dd>
    </div>
  );
}

function MobileCellRender({
  field,
  raw,
  isWinner,
}: {
  field: CompareField;
  raw: unknown;
  isWinner: boolean;
}) {
  const goldCls = isWinner ? "font-semibold text-[var(--gold-warm)]" : "text-foreground";
  switch (field.render) {
    case "composite-rating": {
      const score = raw as number;
      return (
        <span className={cn("inline-flex items-center gap-1 tabular-nums", goldCls)}>
          <Star
            className={cn("h-3.5 w-3.5", isWinner ? "fill-current" : "fill-muted-foreground/40")}
            strokeWidth={0}
          />
          {score.toFixed(1)}
        </span>
      );
    }
    case "rating-pair": {
      const { value, count } = raw as { value: number; count: number };
      return (
        <span className={cn("inline-flex items-center gap-1 tabular-nums", goldCls)}>
          <Star
            className={cn("h-3.5 w-3.5", isWinner ? "fill-current" : "fill-muted-foreground/40")}
            strokeWidth={0}
          />
          {value.toFixed(2)}
          {count > 0 && (
            <span className="text-[10px] font-normal text-muted-foreground">
              ({count.toLocaleString("ja-JP")})
            </span>
          )}
        </span>
      );
    }
    case "yen-range": {
      const { min, max } = raw as { min: number | null; max: number | null };
      const fmt = (n: number) => `${Math.round(n / 10_000).toLocaleString("ja-JP")}万`;
      const label =
        min && max ? `${fmt(min)}〜${fmt(max)}円` : max ? `〜${fmt(max)}円` : min ? `${fmt(min)}円〜` : null;
      return label ? <span className={cn("tabular-nums", goldCls)}>{label}</span> : null;
    }
    case "yen-exact": {
      const n = raw as number;
      return (
        <span className={cn("tabular-nums", goldCls)}>
          {Math.round(n / 10_000).toLocaleString("ja-JP")}万円
        </span>
      );
    }
    case "percent": {
      return (
        <span className={cn("tabular-nums", goldCls)}>{Math.round((raw as number) * 100)}%</span>
      );
    }
    case "people-range": {
      const { min, max } = raw as { min: number | null; max: number | null };
      const label = min && max ? `${min}〜${max}名` : max ? `〜${max}名` : min ? `${min}名〜` : null;
      return label ? <span className={cn("tabular-nums", goldCls)}>{label}</span> : null;
    }
    case "chips": {
      const items = raw as string[];
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      );
    }
    case "text":
      return <span>{raw as string}</span>;
    case "multiline":
      return <p className="whitespace-pre-wrap leading-snug">{raw as string}</p>;
    case "yesno": {
      if (typeof raw === "object" && raw !== null && "has" in raw) {
        const { has, capacity } = raw as { has: boolean | null; capacity: number | null };
        const hasLabel =
          has === true
            ? `あり${capacity !== null ? ` (${capacity}台)` : ""}`
            : has === false
              ? "なし"
              : null;
        return (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px]",
              has === true
                ? "bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)] text-[var(--gold-warm)] font-medium"
                : "bg-muted text-muted-foreground",
            )}
          >
            {hasLabel ?? "—"}
          </span>
        );
      }
      const v = raw as boolean | null;
      return (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            v === true
              ? "bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)] text-[var(--gold-warm)] font-medium"
              : "bg-muted text-muted-foreground",
          )}
        >
          {v === true ? "あり" : v === false ? "なし" : "—"}
        </span>
      );
    }
    default:
      return null;
  }
}

function ChecklistRowMobile({
  item,
  venueId,
  answers,
}: {
  item: { id: string; question: string; type: string };
  venueId: string;
  answers: ComparisonMatrix["answers"];
}) {
  const ans = answers[item.id]?.[venueId];
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-[11px] text-muted-foreground">{item.question}</dt>
      <dd className="flex min-w-0 flex-1 items-start">
        {renderChecklistValue(item.type, ans)}
      </dd>
    </div>
  );
}

function renderChecklistValue(
  type: string,
  ans: ComparisonMatrix["answers"][string][string] | undefined,
) {
  if (!ans) return <span className="text-muted-foreground/40">—</span>;
  if (type === "yesno") {
    if (ans.status === "yes")
      return (
        <span className="rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_15%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--gold-warm)]">
          はい
        </span>
      );
    if (ans.status === "no")
      return (
        <span className="rounded-full bg-[color-mix(in_oklab,var(--destructive)_8%,transparent)] px-2 py-0.5 text-[11px] text-destructive/80">
          いいえ
        </span>
      );
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (type === "memo") {
    return ans.memo ? (
      <p className="line-clamp-2 text-[12px]">{ans.memo}</p>
    ) : (
      <span className="text-muted-foreground/40">—</span>
    );
  }
  if (type === "number") {
    return ans.numberValue !== null ? (
      <span className="tabular-nums text-[12.5px]">
        {ans.numberValue.toLocaleString("ja-JP")}
      </span>
    ) : (
      <span className="text-muted-foreground/40">—</span>
    );
  }
  if (type === "photo") {
    return ans.photoUrls.length > 0 ? (
      <span className="text-[11px] text-muted-foreground">写真 {ans.photoUrls.length}枚</span>
    ) : (
      <span className="text-muted-foreground/40">—</span>
    );
  }
  return null;
}
