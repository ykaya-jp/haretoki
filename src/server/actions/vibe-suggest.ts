"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requireVenueAccess } from "@/server/auth";
import { askClaude, isClaudeAvailable } from "@/lib/claude";
import {
  VIBE_SUGGEST_SYSTEM,
  buildVibeSuggestUserMessage,
} from "@/lib/prompts/vibe-suggest";
import { VIBE_TAGS } from "@/lib/vibe-tags";

const VALID_IDS = new Set<string>(VIBE_TAGS.map((t) => t.id));

const suggestResultSchema = z.object({
  tags: z.array(z.string()),
});

function stripCodeFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

/**
 * R-2 AI vibeTag 自動サジェスト。
 * Claude で最大 4 tag を推定。Claude 未設定時は空配列。
 */
export async function suggestVibeTagsForVenue(
  venueId: string,
): Promise<{ tags: string[] }> {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);

  if (!isClaudeAvailable()) {
    return { tags: [] };
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: {
      name: true,
      location: true,
      accessInfo: true,
      ceremonyStyles: true,
      sourceUrls: true,
    },
  });
  if (!venue) return { tags: [] };

  const userMessage = buildVibeSuggestUserMessage({
    name: venue.name,
    location: venue.location,
    accessInfo: venue.accessInfo,
    ceremonyStyles: venue.ceremonyStyles ?? [],
    sourceUrls: venue.sourceUrls ?? [],
  });

  const raw = await askClaude(VIBE_SUGGEST_SYSTEM, userMessage);
  if (!raw) return { tags: [] };

  try {
    const json = JSON.parse(stripCodeFences(raw));
    const parsed = suggestResultSchema.safeParse(json);
    if (!parsed.success) return { tags: [] };
    const filtered = parsed.data.tags.filter((id) => VALID_IDS.has(id));
    return { tags: filtered.slice(0, 4) };
  } catch {
    return { tags: [] };
  }
}
