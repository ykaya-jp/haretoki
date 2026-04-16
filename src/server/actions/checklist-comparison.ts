"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

export interface ChecklistComparisonData {
  venueNames: string[];
  categories: Array<{
    category: string;
    label: string;
    items: Array<{
      item: string;
      difference: boolean;
      venues: Array<{
        venueId: string;
        venueName: string;
        status: string;
        memo: string | null;
        hasPhotos: boolean;
        /** Up to 3 photo URLs for thumbnail display. */
        photoUrls: string[];
      }>;
    }>;
  }>;
}

export async function getChecklistComparison(
  venueIds: string[],
): Promise<ChecklistComparisonData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get all venues with their visits and checklists
  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, projectId },
    include: {
      visits: {
        include: {
          checklist: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1, // Latest visit per venue
      },
    },
  });

  // Build category → item → venue status map
  const categoryMap = new Map<
    string,
    Map<string, Map<string, { status: string; memo: string | null; hasPhotos: boolean; photoUrls: string[] }>>
  >();

  for (const venue of venues) {
    const visit = venue.visits[0];
    if (!visit) continue;

    for (const item of visit.checklist) {
      const cat = item.category ?? "other";
      if (!categoryMap.has(cat)) categoryMap.set(cat, new Map());
      const itemMap = categoryMap.get(cat);
      if (!itemMap) continue;
      if (!itemMap.has(item.item)) itemMap.set(item.item, new Map());
      const venueMap = itemMap.get(item.item);
      if (!venueMap) continue;
      const urls = item.photoUrls ?? [];
      venueMap.set(venue.id, {
        status: item.status,
        memo: item.memo,
        hasPhotos: urls.length > 0,
        photoUrls: urls.slice(0, 3),
      });
    }
  }

  const CATEGORY_LABELS: Record<string, string> = {
    chapel: "挙式会場",
    facility: "設備",
    banquet: "披露宴会場",
    dress_item: "衣裳・アイテム",
    staff_estimate: "スタッフ・見積り",
    cuisine_drink: "料理・飲み物",
  };

  const CATEGORY_ORDER = ["chapel", "facility", "banquet", "dress_item", "staff_estimate", "cuisine_drink"];

  const venueMap = new Map(venues.map(v => [v.id, v.name]));

  const categories = [...categoryMap.entries()]
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0]);
      const bi = CATEGORY_ORDER.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    })
    .map(([category, itemMap]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      items: [...itemMap.entries()].map(([item, venueStatuses]) => {
        const rows = venueIds.map(id => ({
          venueId: id,
          venueName: venueMap.get(id) ?? "",
          status: venueStatuses.get(id)?.status ?? "unchecked",
          memo: venueStatuses.get(id)?.memo ?? null,
          hasPhotos: venueStatuses.get(id)?.hasPhotos ?? false,
          photoUrls: venueStatuses.get(id)?.photoUrls ?? [],
        }));
        const statuses = new Set(rows.map(r => r.status));
        const difference = statuses.size > 1;
        return { item, difference, venues: rows };
      }),
    }));

  const venueNames = venueIds.map(id => venueMap.get(id) ?? "");
  return { venueNames, categories };
}
