import { describe, it, expectTypeOf } from "vitest";
import type {
  ChecklistItemAnswer,
  ChecklistItemComparison,
  DimensionWithChecklist,
  UnifiedComparisonData,
  ComparisonVenue,
} from "@/server/actions/unified-comparison";

describe("unified-comparison types", () => {
  it("ChecklistItemAnswer has status and memo", () => {
    expectTypeOf<ChecklistItemAnswer>().toMatchTypeOf<{
      status: string | null;
      memo: string | null;
    }>();
  });

  it("ChecklistItemComparison has answers keyed by venueId", () => {
    expectTypeOf<ChecklistItemComparison["answers"]>().toMatchTypeOf<
      Record<string, ChecklistItemAnswer>
    >();
    expectTypeOf<ChecklistItemComparison["hasDifference"]>().toBeBoolean();
  });

  it("DimensionWithChecklist has scores and checklist", () => {
    expectTypeOf<DimensionWithChecklist["scores"]>().toMatchTypeOf<
      Record<string, number | null>
    >();
    expectTypeOf<DimensionWithChecklist["checklistItems"]>().toMatchTypeOf<
      ChecklistItemComparison[]
    >();
    expectTypeOf<DimensionWithChecklist["winnerId"]>().toMatchTypeOf<string | null>();
  });

  it("UnifiedComparisonData has venues, dimensions, totalScore, costWinnerId, unmappedItems", () => {
    expectTypeOf<UnifiedComparisonData["venues"]>().toMatchTypeOf<ComparisonVenue[]>();
    expectTypeOf<UnifiedComparisonData["dimensions"]>().toMatchTypeOf<
      DimensionWithChecklist[]
    >();
    expectTypeOf<UnifiedComparisonData["totalScore"]>().toMatchTypeOf<
      Record<string, number | null>
    >();
    expectTypeOf<UnifiedComparisonData["costWinnerId"]>().toMatchTypeOf<string | null>();
    expectTypeOf<UnifiedComparisonData["unmappedItems"]>().toMatchTypeOf<
      ChecklistItemComparison[]
    >();
  });
});
