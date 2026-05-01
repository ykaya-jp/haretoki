import { z } from "zod";

/**
 * Pure parsing helpers for Claude's estimate-extraction JSON response.
 *
 * Kept in `src/lib` (not `src/server/actions`) because a file with the
 * "use server" directive may only export async functions. These helpers
 * are sync, pure, and unit-testable in isolation — exactly the surface
 * we want reachable without booting the whole action layer.
 *
 * 2026-05-02 round 3 — schema strict 化:
 *  - `category` を `EstimateCategory` (8 値 enum) に強制
 *  - `tier` を `EstimateItemTier` (4 値 enum) に強制
 *  - `amount` は負値も許可 (値引き行 = ご祝儀値引きなど)
 *  - `total` の sum-vs-items 乖離 detect → `parseEstimateExtraction` の戻り値に
 *    `warnings` を追加 (10% 超で「items 合計と総額に X% 乖離」を入れる)
 *  - hallucinationガードを caller に伝える経路を提供 (UI で「AI 抽出に注意」表示できる)
 */

/** Categories accepted by the server-side estimateSchema enum. Mirror of
 *  `EstimateCategory` in src/lib/estimate-presets.ts so the parser refuses
 *  any out-of-band category Claude might emit. */
const CATEGORY_VALUES = [
  "attire",
  "cuisine",
  "photo_video",
  "flowers",
  "performance",
  "av_equipment",
  "venue_fee",
  "other",
] as const;

const TIER_VALUES = ["minimum", "standard", "premium", "unknown"] as const;

export const EstimateExtractionSchema = z.object({
  total: z.number().nonnegative(),
  items: z.array(
    z.object({
      category: z.enum(CATEGORY_VALUES),
      itemName: z.string().min(1),
      // amount can be negative for discounts (値引き / ご祝儀値引き) —
      // round 3 loosens the prior `nonnegative()` constraint to admit
      // those rows without forcing the prompt to drop them.
      amount: z.number(),
      unit: z.string().optional(),
      quantity: z.number().optional(),
      tier: z.enum(TIER_VALUES),
    }),
  ),
  predictedFinal: z.number().nonnegative(),
  analysisNote: z.string(),
});

export type ExtractedEstimate = z.infer<typeof EstimateExtractionSchema>;

/**
 * Strip Claude's occasional JSON wrapping (```json fences, "Here's the
 * analysis:" preamble, etc.) before parsing. Mirrors the review-summary
 * and onboarding paths so behaviour stays consistent.
 *
 * Order:
 *  1. fenced code block (```json ... ``` or ``` ... ```)
 *  2. first "{" ... last "}" slice (catches unfenced preamble)
 *  3. raw trimmed string (already clean JSON)
 */
export function stripJsonFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return raw.slice(first, last + 1).trim();
  }
  return raw.trim();
}

/** Compare items.amount sum against total. Anything beyond TOTAL_DRIFT_PCT
 *  triggers a soft warning so the UI can hint "AI 抽出に乖離あり、要確認".
 *  10% chosen because tax-inclusive vs tax-exclusive shifts in the worst
 *  case are 10% (consumption tax 10%) — anything bigger is structural
 *  (missed rows / double counting). */
const TOTAL_DRIFT_PCT = 10;

function computeTotalDriftWarning(data: ExtractedEstimate): string | null {
  if (data.items.length === 0) return null;
  const itemSum = data.items.reduce((acc, it) => acc + it.amount, 0);
  if (data.total === 0) return null;
  const driftPct = Math.abs((itemSum - data.total) / data.total) * 100;
  if (driftPct <= TOTAL_DRIFT_PCT) return null;
  const sign = itemSum > data.total ? "超過" : "不足";
  return `items 合計 (¥${Math.round(itemSum / 10000)}万) と total (¥${Math.round(
    data.total / 10000,
  )}万) で ${driftPct.toFixed(1)}% の乖離 (items が ${sign})。税抜/税込混在 or 抽出漏れの可能性。`;
}

export interface ParsedEstimateResult {
  data: ExtractedEstimate;
  /** Soft warnings — non-fatal, surface to UI for "要確認" badge. */
  warnings: string[];
}

/**
 * Parse + validate an extraction-shaped JSON payload. Exported so the
 * action-layer path and unit tests share the exact same acceptance
 * criteria — no drift between "what a test passes" and "what production
 * accepts".
 *
 * Returns `warnings` (empty when no issues) so the caller can both
 * accept the data AND surface non-fatal sanity-check hints.
 */
export function parseEstimateExtraction(
  rawClaudeResponse: string,
):
  | { ok: true; data: ExtractedEstimate; warnings: string[] }
  | { ok: false; error: string } {
  const stripped = stripJsonFence(rawClaudeResponse);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    return {
      ok: false,
      error: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const validated = EstimateExtractionSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `schema validation failed: ${validated.error.message}`,
    };
  }
  const warnings: string[] = [];
  const driftWarning = computeTotalDriftWarning(validated.data);
  if (driftWarning) warnings.push(driftWarning);
  return { ok: true, data: validated.data, warnings };
}
