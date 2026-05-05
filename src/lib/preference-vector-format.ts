/**
 * Pure synchronous formatter for PreferenceVector. Lives outside the
 * `"use server"` boundary so it can be imported wherever (Server / Client
 * Component / unit test) without the "Server Actions must be async"
 * compile error that bit us when this lived alongside getPreferenceVector
 * in preference-vector.ts.
 */

import type { PreferenceVector } from "@/server/actions/preference-vector";

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
