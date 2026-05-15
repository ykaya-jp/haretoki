import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getVenueHeader } from "@/server/actions/venues";
import { getCoupleRatings } from "@/server/actions/ratings";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { RatingSection } from "@/components/venues/rating-section";
import { PartnerComparisonSummary } from "@/components/ratings/partner-comparison-summary";
import {
  ChildRatingPanel,
  type ChildRatingItem,
} from "@/components/venues/child-rating-panel";
import { prisma } from "@/server/db";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";
import {
  ITEM_TO_DIMENSION,
  getDimensionForPreset,
} from "@/lib/dimension-checklist-map";
import type { Tier1Dimension } from "@/lib/constants";

const CATEGORY_TO_DIMENSION: Record<string, Tier1Dimension> = {
  chapel: "ceremony_space",
  banquet: "banquet_space",
  cuisine_drink: "cuisine",
  dress_item: "attire_items",
  staff_estimate: "hospitality",
  facility: "logistics",
};

/**
 * Focused-mode rating page — v3 plan §1.1 C画面 + Phase 0 fix.
 *
 * Why a separate route from `/venues/[id]`:
 *   - The detail page is dense (review clusters, plans, estimates,
 *     visit notes, similar venues, vibe tags…). On 375px mobile the
 *     "印象を残す" section is below the fold for any venue with content.
 *     Couples returning from a 見学 want to **immediately** dump their
 *     impressions while still fresh — every extra section to scroll
 *     past raises the abandonment rate.
 *   - A standalone route also gives a clean deep-link target from the
 *     home dashboard freshness chip (added in a later PR) without
 *     having to URL-hash to a section ID.
 *
 * Layout intent:
 *   1. Sticky breadcrumb back to /venues/[id] so the focused mode never
 *      feels like a trap.
 *   2. Venue hero photo (cinematic, no caption / metadata) — establishes
 *      "this is the place" before the question "how did it feel?".
 *   3. RatingSection in its native form, but with extra vertical padding
 *      so each dimension's rating bar gets a full reading rest.
 *   4. (optional) PartnerComparisonSummary streams in below the bars
 *      once getCoupleRatings resolves — same fault-tolerant pattern as
 *      the detail page (= partner fetch never blocks the input UI).
 */
export default async function VenueImpressionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const venue = await getVenueHeader(id);
  if (!venue) notFound();

  // userRatings projection mirrors the detail page (= same scoring rows
  // already loaded, no extra round-trip).
  const userRatings: Record<string, number> = {};
  for (const score of venue.scores) {
    if (score.source === "user_rating") {
      userRatings[score.dimension] = Number(score.score);
    }
  }

  // Load active checklist items (preset + custom) and any pre-existing
  // numericScore on this venue. Parallel-fetched because they're
  // independent. The output drives the new ChildRatingPanel below the
  // parent 8-dim RatingSection.
  const [activeChecklists, customItems, existingAnswers] = await Promise.all([
    prisma.projectChecklist.findMany({
      where: { projectId },
      select: { id: true, itemId: true },
    }),
    prisma.customChecklistItem.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, question: true, category: true },
    }),
    prisma.venueChecklistAnswer.findMany({
      where: { venueId: id, projectChecklist: { projectId } },
      select: {
        projectChecklistId: true,
        numericScore: true,
        projectChecklist: { select: { itemId: true } },
      },
    }),
  ]);

  const presetById = new Map(CHECKLIST_PRESETS.map((p) => [p.id, p]));
  const scoreByItemId = new Map<string, number | null>(
    existingAnswers.map((a) => [
      a.projectChecklist.itemId,
      a.numericScore !== null ? Number(a.numericScore) : null,
    ]),
  );
  const customDimLookup: Record<string, Tier1Dimension> = {};
  const customById = new Map<string, { label: string; dim: Tier1Dimension }>();
  for (const c of customItems) {
    const dim = CATEGORY_TO_DIMENSION[c.category] ?? "overall";
    customDimLookup[c.id] = dim;
    customById.set(c.id, { label: c.question, dim });
  }

  const childItems: ChildRatingItem[] = [];
  for (const row of activeChecklists) {
    const preset = presetById.get(row.itemId);
    if (preset) {
      childItems.push({
        itemId: row.itemId,
        dimension: getDimensionForPreset(row.itemId),
        label: preset.question,
        subcategory: preset.subcategory ?? null,
        initialScore: scoreByItemId.get(row.itemId) ?? null,
      });
      continue;
    }
    const custom = customById.get(row.itemId);
    if (custom) {
      childItems.push({
        itemId: row.itemId,
        dimension: custom.dim,
        label: custom.label,
        subcategory: null,
        initialScore: scoreByItemId.get(row.itemId) ?? null,
      });
    }
    // Unknown itemId (= preset removed from CHECKLIST_PRESETS but still
    // active in this project) silently skipped. ITEM_TO_DIMENSION
    // referenced here for symmetry with aggregator.
    void ITEM_TO_DIMENSION;
  }

  return (
    <main className="mx-auto max-w-[640px] pb-32">
      <header className="sticky top-0 z-20 -mx-5 flex items-center gap-3 border-b border-border/40 bg-background/85 px-5 py-3 backdrop-blur-md">
        <Link
          href={`/venues/${venue.id}`}
          prefetch
          aria-label={`${venue.name} の詳細に戻る`}
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs italic text-muted-foreground active:bg-muted active:scale-[0.97] transition-transform"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          詳細へ戻る
        </Link>
        <span
          className="ml-auto text-[10.5px] uppercase tracking-[0.28em] text-[var(--gold-warm)]"
          aria-hidden
        >
          impression
        </span>
      </header>

      <section className="-mx-5 mt-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[color-mix(in_oklab,var(--gold-warm)_18%,var(--background))] to-[color-mix(in_oklab,var(--gold-warm)_4%,var(--background))]">
          {venue.photoUrls?.[0] ? (
            <Image
              src={venue.photoUrls[0]}
              alt={venue.name}
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-cover"
              priority
            />
          ) : null}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent"
          />
        </div>
      </section>

      <section className="-mt-8 px-1">
        <div className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--gold-warm)]">
          recalling
        </div>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-light leading-tight tracking-tight sm:text-4xl">
          {venue.name}
        </h1>
        {venue.location ? (
          <p className="mt-1 text-xs italic text-muted-foreground">
            {venue.location}
          </p>
        ) : null}
      </section>

      <section className="mt-8 px-1">
        <RatingSection venueId={venue.id} initialRatings={userRatings} />
      </section>

      <Suspense fallback={null}>
        <ImpressionPartnerOverlay
          venueId={venue.id}
          userRatings={userRatings}
        />
      </Suspense>

      {/* PR #51: child item rating panel — addresses "子項目自体の評価が
          できる画面がない" feedback. Renders below the 8-dim parent
          RatingSection so users can both quick-rate (top) and detail-rate
          (bottom) on the same focused-mode page. */}
      <section className="mt-10 px-1">
        <ChildRatingPanel
          venueId={venue.id}
          items={childItems}
          customLookup={customDimLookup}
        />
      </section>

      <footer className="mt-12 px-2 text-center">
        <p className="text-[11px] italic text-muted-foreground/80">
          つけ忘れがあっても 自動で保存されます。<br />
          いつでも 詳細ページ から 続きを残せます。
        </p>
      </footer>
    </main>
  );
}

async function ImpressionPartnerOverlay({
  venueId,
  userRatings,
}: {
  venueId: string;
  userRatings: Record<string, number>;
}) {
  const coupleRatings = await getCoupleRatings(venueId).catch(() => null);
  const partnerRatings: Record<string, number> = {};
  if (coupleRatings?.otherRatings) {
    for (const [dim, score] of Object.entries(
      coupleRatings.otherRatings.ratings,
    )) {
      partnerRatings[dim] = score;
    }
  }
  if (Object.keys(partnerRatings).length === 0) return null;

  return (
    <section className="mt-8 px-1">
      <PartnerComparisonSummary
        venueId={venueId}
        myRatings={userRatings}
        partnerRatings={partnerRatings}
      />
    </section>
  );
}
