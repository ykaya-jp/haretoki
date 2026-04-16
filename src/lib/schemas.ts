import { z } from "zod";
import type { ProjectConditions } from "@/types";

// --- SavedSearchFilters ---

export interface SavedSearchFilters {
  area?: string[];
  budgetMax?: number;
  capacityMin?: number;
  vibeTags?: string[];
  keyword?: string;
}

export const SavedSearchFiltersSchema = z.object({
  area: z.array(z.string()).optional(),
  budgetMax: z.number().optional(),
  capacityMin: z.number().optional(),
  vibeTags: z.array(z.string()).optional(),
  keyword: z.string().optional(),
});

/** Parse Prisma JsonValue to SavedSearchFilters, returning null if invalid. */
export function parseSavedSearchFilters(raw: unknown): SavedSearchFilters | null {
  const result = SavedSearchFiltersSchema.safeParse(raw);
  return result.success ? result.data : null;
}

// --- ProjectConditions ---

/** Zod schema matching the ProjectConditions type stored in Project.conditions JSON field. */
export const ProjectConditionsSchema = z.object({
  area: z.array(z.string()).optional(),
  dateRange: z.string().optional(),
  guestCount: z.number().optional(),
  budget: z
    .object({ min: z.number(), max: z.number() })
    .optional(),
  style: z.array(z.string()).optional(),
});

/** Parse Prisma JsonValue to ProjectConditions, returning null if invalid or empty. */
export function parseConditions(raw: unknown): ProjectConditions | null {
  const result = ProjectConditionsSchema.safeParse(raw);
  return result.success ? result.data : null;
}
