"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
  ESTIMATE_CATEGORY_LABELS,
  ESTIMATE_CATEGORY_ORDER,
  type EstimateBreakdownComparison,
  type EstimateCategory,
  type EstimateGroup,
  type EstimateItemCell,
  type EstimateItemRow,
} from "@/lib/estimate-breakdown-types";

/**
 * Cross-venue estimate breakdown — gives /compare a row-per-item view
 * so couples can ask "how much does dress cost at A vs B vs C?" at a
 * glance instead of bouncing between three venue detail pages.
 *
 * Aggregation rules:
 *   - Pull the LATEST Estimate (highest version) per venue
 *   - Group items by `category` (8 enum values) and within each
 *     category list every distinct `itemName` that any venue has
 *   - For each (category, itemName) emit a row with one cell per
 *     venue: amount + tier (or null when that venue's estimate
 *     doesn't list this line)
 *   - Highlight the cheapest non-null cell so couples can spot
 *     savings without doing math
 *
 * Returns empty when no venue has any estimate yet — UI hides itself.
 *
 * Type / constant exports moved to `src/lib/estimate-breakdown-types.ts`
 * because `"use server"` files can only export async functions.
 */
export async function getEstimateBreakdownComparison(
  venueIds: string[],
): Promise<EstimateBreakdownComparison> {
  const empty: EstimateBreakdownComparison = {
    venueIds: [],
    groups: [],
    grandTotalByVenueId: {},
  };
  if (venueIds.length === 0) return empty;

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, projectId, deletedAt: null },
    select: {
      id: true,
      estimates: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          items: {
            select: {
              category: true,
              itemName: true,
              amount: true,
              tier: true,
            },
          },
        },
      },
    },
  });

  // Filter: keep venue order from input but drop venues without estimates
  const orderedVenues = venueIds
    .map((id) => venues.find((v) => v.id === id))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  const venuesWithItems = orderedVenues.filter(
    (v) => v.estimates[0]?.items?.length,
  );
  if (venuesWithItems.length === 0) return empty;

  // Build a (category → itemName → venueId → cell) shape, then flatten.
  const matrix = new Map<EstimateCategory, Map<string, Map<string, EstimateItemCell>>>();

  for (const venue of venuesWithItems) {
    const items = venue.estimates[0]?.items ?? [];
    for (const it of items) {
      const cat = it.category as EstimateCategory;
      const byItem = matrix.get(cat) ?? new Map();
      const byVenue = byItem.get(it.itemName) ?? new Map();
      byVenue.set(venue.id, {
        amount: it.amount,
        tier: it.tier,
        isCheapest: false, // resolved below
      });
      byItem.set(it.itemName, byVenue);
      matrix.set(cat, byItem);
    }
  }

  const venueIdsWithItems = venuesWithItems.map((v) => v.id);
  const grandTotalByVenueId: Record<string, number> = Object.fromEntries(
    venueIdsWithItems.map((id) => [id, 0]),
  );

  const groups: EstimateGroup[] = [];
  for (const category of ESTIMATE_CATEGORY_ORDER) {
    const byItem = matrix.get(category);
    if (!byItem) continue;

    const rows: EstimateItemRow[] = [];
    const subtotalByVenueId: Record<string, number> = Object.fromEntries(
      venueIdsWithItems.map((id) => [id, 0]),
    );

    // Stable item order: alphabetical within category
    const itemNames = [...byItem.keys()].sort((a, b) =>
      a.localeCompare(b, "ja"),
    );

    for (const itemName of itemNames) {
      const byVenue = byItem.get(itemName)!;
      const cells: Record<string, EstimateItemCell | null> = {};

      // Find cheapest non-null cell to highlight
      let cheapest = Number.POSITIVE_INFINITY;
      for (const id of venueIdsWithItems) {
        const cell = byVenue.get(id) ?? null;
        if (cell && cell.amount < cheapest) cheapest = cell.amount;
      }

      for (const id of venueIdsWithItems) {
        const cell = byVenue.get(id) ?? null;
        if (cell) {
          cells[id] = {
            ...cell,
            isCheapest: cell.amount === cheapest && cheapest > 0,
          };
          subtotalByVenueId[id] += cell.amount;
        } else {
          cells[id] = null;
        }
      }

      rows.push({ category, itemName, cellsByVenueId: cells });
    }

    // Compute cheapest subtotal venue
    let cheapestSubtotal = Number.POSITIVE_INFINITY;
    let cheapestSubtotalVenueId: string | null = null;
    for (const id of venueIdsWithItems) {
      const sub = subtotalByVenueId[id];
      if (sub > 0 && sub < cheapestSubtotal) {
        cheapestSubtotal = sub;
        cheapestSubtotalVenueId = id;
      }
    }

    for (const id of venueIdsWithItems) {
      grandTotalByVenueId[id] += subtotalByVenueId[id];
    }

    groups.push({
      category,
      label: ESTIMATE_CATEGORY_LABELS[category],
      rows,
      subtotalByVenueId,
      cheapestSubtotalVenueId,
    });
  }

  return {
    venueIds: venueIdsWithItems,
    groups,
    grandTotalByVenueId,
  };
}
