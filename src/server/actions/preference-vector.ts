"use server";

import { prisma } from "@/server/db";
import { requireProjectMembership, requireUser } from "@/server/auth";

/**
 * Inferred preference signals derived from how the couple has interacted
 * with venues (favorites + visits). Pinterest-style learning: the more
 * they engage, the sharper the vector. With zero engagement we return
 * `cold: true` so callers can show a "好みデータ収集中" branch instead of
 * shipping a confidently-wrong prompt to Claude.
 *
 * Each field is a frequency-weighted top-K aggregation over the venues
 * the couple has positively engaged with (heart or visit). We deliberately
 * do NOT include onboarding `conditions` here — that's a separate input
 * the existing Claude prompt already uses. This vector represents the
 * couple's *behavioral* preference, which often diverges from what they
 * declared at onboarding (e.g. answered "natural light" but kept hearting
 * elegant ballrooms).
 */
export interface PreferenceVector {
  cold: boolean;
  topVibes: string[];
  topStyles: string[];
  topAreas: string[];
  capacityRange: { min: number; max: number } | null;
  costRange: { min: number; max: number } | null;
  signalCount: number;
}

const COLD_THRESHOLD = 2;

export async function getPreferenceVector(): Promise<PreferenceVector> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [favorites, visits] = await Promise.all([
    prisma.venueFavorite.findMany({
      where: { venue: { projectId, deletedAt: null } },
      select: {
        venue: {
          select: {
            id: true,
            vibeTags: true,
            ceremonyStyles: true,
            location: true,
            capacityMin: true,
            capacityMax: true,
            costMin: true,
            costMax: true,
          },
        },
      },
      take: 100,
    }),
    prisma.visit.findMany({
      where: { venue: { projectId, deletedAt: null }, deletedAt: null },
      select: {
        venue: {
          select: {
            id: true,
            vibeTags: true,
            ceremonyStyles: true,
            location: true,
            capacityMin: true,
            capacityMax: true,
            costMin: true,
            costMax: true,
          },
        },
      },
      take: 100,
    }),
  ]);

  const seen = new Set<string>();
  const venues: Array<{
    vibeTags: string[];
    ceremonyStyles: string[];
    location: string | null;
    capacityMin: number | null;
    capacityMax: number | null;
    costMin: number | null;
    costMax: number | null;
  }> = [];
  for (const f of favorites) {
    if (seen.has(f.venue.id)) continue;
    seen.add(f.venue.id);
    venues.push(f.venue);
  }
  for (const v of visits) {
    if (seen.has(v.venue.id)) continue;
    seen.add(v.venue.id);
    venues.push(v.venue);
  }

  const signalCount = venues.length;

  if (signalCount < COLD_THRESHOLD) {
    return {
      cold: true,
      topVibes: [],
      topStyles: [],
      topAreas: [],
      capacityRange: null,
      costRange: null,
      signalCount,
    };
  }

  // Frequency aggregation. Top-K = 3 keeps the prompt compact while
  // covering the dominant pattern; ties tolerated, no explicit lex sort
  // because Claude doesn't care about insertion order at this length.
  const vibeFreq = new Map<string, number>();
  const styleFreq = new Map<string, number>();
  const areaFreq = new Map<string, number>();
  let capMinSum = 0;
  let capMaxSum = 0;
  let capCount = 0;
  let costMinSum = 0;
  let costMaxSum = 0;
  let costCount = 0;

  for (const v of venues) {
    for (const tag of v.vibeTags) vibeFreq.set(tag, (vibeFreq.get(tag) ?? 0) + 1);
    for (const style of v.ceremonyStyles) styleFreq.set(style, (styleFreq.get(style) ?? 0) + 1);
    if (v.location) {
      // Trim location to prefecture / district hint — first ~6 chars
      // typically the 都道府県 prefix on Japanese venue addresses.
      const areaKey = v.location.slice(0, 6);
      areaFreq.set(areaKey, (areaFreq.get(areaKey) ?? 0) + 1);
    }
    if (v.capacityMin !== null && v.capacityMax !== null) {
      capMinSum += v.capacityMin;
      capMaxSum += v.capacityMax;
      capCount++;
    }
    if (v.costMin !== null && v.costMax !== null) {
      costMinSum += v.costMin;
      costMaxSum += v.costMax;
      costCount++;
    }
  }

  const topK = (m: Map<string, number>, k: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([key]) => key);

  return {
    cold: false,
    topVibes: topK(vibeFreq, 3),
    topStyles: topK(styleFreq, 3),
    topAreas: topK(areaFreq, 3),
    capacityRange: capCount > 0
      ? { min: Math.round(capMinSum / capCount), max: Math.round(capMaxSum / capCount) }
      : null,
    costRange: costCount > 0
      ? { min: Math.round(costMinSum / costCount), max: Math.round(costMaxSum / costCount) }
      : null,
    signalCount,
  };
}

/**
 * Build a one-paragraph Japanese description of the preference vector
 * suitable for inlining into a Claude prompt. Returns `null` when cold —
 * callers should skip prompt augmentation in that case (no useful signal).
 */
export function summarizePreferenceVector(p: PreferenceVector): string | null {
  if (p.cold) return null;
  const parts: string[] = [];
  if (p.topVibes.length > 0) {
    parts.push(`雰囲気の好み: ${p.topVibes.join("・")}`);
  }
  if (p.topStyles.length > 0) {
    parts.push(`挙式スタイルの好み: ${p.topStyles.join("・")}`);
  }
  if (p.topAreas.length > 0) {
    parts.push(`エリアの好み: ${p.topAreas.join("・")}`);
  }
  if (p.capacityRange) {
    parts.push(
      `収容人数の傾向: ${p.capacityRange.min}〜${p.capacityRange.max}名`,
    );
  }
  if (p.costRange) {
    parts.push(
      `費用感の傾向: ${Math.round(p.costRange.min / 10000)}〜${Math.round(p.costRange.max / 10000)}万円`,
    );
  }
  if (parts.length === 0) return null;
  return (
    `おふたりが今までお気に入り・見学に追加した ${p.signalCount} 件の式場から見える嗜好:\n` +
    parts.map((s) => `- ${s}`).join("\n")
  );
}
