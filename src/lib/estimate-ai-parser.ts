import { z } from "zod";

/**
 * Pure parsing helpers for Claude's estimate-extraction JSON response.
 *
 * Kept in `src/lib` (not `src/server/actions`) because a file with the
 * "use server" directive may only export async functions. These helpers
 * are sync, pure, and unit-testable in isolation — exactly the surface
 * we want reachable without booting the whole action layer.
 */

export const EstimateExtractionSchema = z.object({
  total: z.number().nonnegative(),
  items: z.array(
    z.object({
      category: z.string(),
      itemName: z.string().min(1),
      amount: z.number().nonnegative(),
      unit: z.string().optional(),
      quantity: z.number().optional(),
      tier: z.string(),
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

/**
 * Parse + validate an extraction-shaped JSON payload. Exported so the
 * action-layer path and unit tests share the exact same acceptance
 * criteria — no drift between "what a test passes" and "what production
 * accepts".
 */
export function parseEstimateExtraction(
  rawClaudeResponse: string,
): { ok: true; data: ExtractedEstimate } | { ok: false; error: string } {
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
  return { ok: true, data: validated.data };
}
