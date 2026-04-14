import { z } from "zod";

// Zod schema for Review.estimateIncrease Json payload.
// All fields are optional so that AI extraction and manual entry can partial-fill.
export const estimateIncreaseSchema = z.object({
  initial: z.number().int().nonnegative().optional(),
  final: z.number().int().nonnegative().optional(),
  deltaYen: z.number().int().optional(),
  deltaPct: z.number().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  note: z.string().max(500).optional(),
});

export type EstimateIncrease = z.infer<typeof estimateIncreaseSchema>;

export function parseEstimateIncrease(input: unknown): EstimateIncrease | null {
  if (input == null || typeof input !== "object") return null;
  const result = estimateIncreaseSchema.safeParse(input);
  if (!result.success) return null;
  // Treat all-undefined object as empty (null) to avoid writing empty payloads
  const hasAny = Object.values(result.data).some((v) => v !== undefined);
  return hasAny ? result.data : null;
}

/**
 * Pure aggregation of estimate-increase data across multiple reviews.
 * Averages deltaYen and deltaPct independently (skipping undefined values).
 * Exposed separately so it can be unit-tested without a Prisma client.
 */
export function aggregateEstimateIncrease(
  payloads: ReadonlyArray<EstimateIncrease | null | undefined>,
): {
  deltaYen: number | null;
  deltaPct: number | null;
  sampleCount: number;
} {
  const parsed = payloads.filter((p): p is EstimateIncrease => p != null);
  const yenValues = parsed
    .map((p) => p.deltaYen)
    .filter((v): v is number => typeof v === "number");
  const pctValues = parsed
    .map((p) => p.deltaPct)
    .filter((v): v is number => typeof v === "number");

  const avgYen =
    yenValues.length > 0
      ? Math.round(yenValues.reduce((a, b) => a + b, 0) / yenValues.length)
      : null;
  const avgPct =
    pctValues.length > 0
      ? Math.round((pctValues.reduce((a, b) => a + b, 0) / pctValues.length) * 100) / 100
      : null;

  return { deltaYen: avgYen, deltaPct: avgPct, sampleCount: parsed.length };
}
