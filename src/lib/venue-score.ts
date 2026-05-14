/**
 * @deprecated import from "@/lib/scoring" instead. This shim re-exports the
 * consolidated symbols so existing callers keep working through a transitional
 * period; planned removal in a follow-up PR once all callers are migrated.
 */
export { SCORE_SOURCE_WEIGHTS, computeCompositeScore } from "@/lib/scoring";
