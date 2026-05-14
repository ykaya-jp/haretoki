/**
 * @deprecated import from "@/lib/scoring" instead. This shim re-exports the
 * consolidated symbols so existing callers keep working through a transitional
 * period; planned removal in a follow-up PR once all callers are migrated.
 */
export {
  WEIGHT_MIN,
  WEIGHT_MAX,
  WEIGHT_DEFAULT,
  normalizeWeight,
  defaultWeights,
  coerceWeights,
  computeWeighted,
  aggregateScoresByDimension,
  computeWeightedComposite,
  computeCoupleWeights,
  opinionAlignmentScore,
  alignmentBucket,
} from "@/lib/scoring";

export type {
  DimensionWeights,
  Weights,
  ScoreByDimension,
  AlignmentBucket,
} from "@/lib/scoring";
