# W11-1 Compare arrows & partner-diff sort

## Plan
- Feature A: directional advantage indicator in compare-redesigned.tsx (only when exactly 2 venues)
- Feature B: "意見差を上に" toggle — sort dimensions by |owner−partner| score, show top 1-2 as "話し合いましょう" chip
- Pure calc util in `src/lib/comparison-advantage.ts` with unit tests
- Client fetch of per-venue getPartnerRatings (existing action, no server changes)

## Files
- NEW: src/lib/comparison-advantage.ts
- NEW: tests/unit/lib/comparison-advantage.test.ts
- EDIT: src/components/comparison/compare-redesigned.tsx

## Thresholds
- spread < 0.5 → "ほぼ同じ"
- 0.5 ≤ spread < 1.0 → 単一 arrow + gold accent
- spread ≥ 1.0 → 二重 arrow + gold fill (明確に優勢)

## Review
- Pure calc util `src/lib/comparison-advantage.ts` — classifyAdvantage / computePartnerOpinionDiff / aggregatePartnerDiffAcrossVenues
- 11 unit tests cover thresholds (0.5 tie, 1.0 strong), null guards, across-venue max
- compare-redesigned.tsx wired: AdvantageCaption arrow only when exactly 2 venues; partner-diff toggle lazy-loads via existing getPartnerRatings per venue; top-2 dimensions get "話し合いましょう" chip when magnitude >= 1.0
- set-state-in-effect avoided via queueMicrotask (per global React 19 rule)
- verify --fast: lint 0 errors / tsc / 331 vitest all green; next build compiles OK
