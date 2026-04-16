"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { buildVenueWhere } from "@/server/actions/venue-filters";
import {
  type SavedSearchFilters,
  parseSavedSearchFilters,
} from "@/lib/schemas";


export interface SavedSearchRow {
  id: string;
  label: string;
  filters: SavedSearchFilters;
  createdAt: string;
}

const MAX_SAVED_SEARCHES = 5;

/** Create a saved search. Max 5 per project. */
export async function createSavedSearch(
  label: string,
  filters: SavedSearchFilters,
): Promise<{ ok: true; id: string } | { ok: false; reason: "limit" | "error" }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const count = await prisma.savedSearch.count({ where: { projectId } });
  if (count >= MAX_SAVED_SEARCHES) {
    return { ok: false, reason: "limit" };
  }

  const saved = await prisma.savedSearch.create({
    data: {
      projectId,
      userId: user.id,
      label: label.trim(),
      filters: filters as object,
    },
  });

  revalidatePath("/mypage/saved-searches");
  return { ok: true, id: saved.id };
}

/** List all saved searches for the current user's project. */
export async function listSavedSearches(): Promise<SavedSearchRow[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const rows = await prisma.savedSearch.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, filters: true, createdAt: true },
  });

  return rows.flatMap((r) => {
    const filters = parseSavedSearchFilters(r.filters);
    if (!filters) return [];
    return [{ id: r.id, label: r.label, filters, createdAt: r.createdAt.toISOString() }];
  });
}

/** Delete a saved search (membership + ownership check). */
export async function deleteSavedSearch(
  id: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const row = await prisma.savedSearch.findUnique({ where: { id } });
  if (!row || row.projectId !== projectId) {
    return { ok: false, reason: "not_found" };
  }

  await prisma.savedSearch.delete({ where: { id } });
  revalidatePath("/mypage/saved-searches");
  return { ok: true };
}

/** Count venues that currently match a saved search's filters. */
export async function matchesSavedSearchCount(searchId: string): Promise<number> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const row = await prisma.savedSearch.findUnique({ where: { id: searchId } });
  if (!row || row.projectId !== projectId) return 0;

  const f = parseSavedSearchFilters(row.filters);
  if (!f) return 0;
  const where = buildVenueWhere(projectId, {
    areas: f.area,
    budgetMax: f.budgetMax,
    guestCount: f.capacityMin,
    query: f.keyword,
    styles: f.vibeTags,
  });

  return prisma.venue.count({ where });
}
