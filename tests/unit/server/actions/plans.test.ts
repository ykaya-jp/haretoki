import { describe, it, expect } from "vitest";
import { validatePlanInput } from "@/server/actions/plan-schema";

describe("validatePlanInput", () => {
  it("accepts a minimal valid plan", () => {
    const result = validatePlanInput({ name: "ベーシックプラン" });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated plan", () => {
    const result = validatePlanInput({
      name: "プレミアムプラン",
      basePrice: 3_000_000,
      guestCountMin: 30,
      guestCountMax: 80,
      includedItems: ["衣裳1着", "ブーケ"],
      excludedItems: ["装花アップグレード"],
      bringInItems: [{ item: "ドレス", fee: 50000 }],
      dressBrideCount: 2,
      dressGroomCount: 1,
      dressBudgetCapYen: 800_000,
      dressAllowanceNote: "提携外は持込料あり",
      campaigns: [{ name: "早期割", discount: "10万円OFF" }],
      notes: "備考",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = validatePlanInput({ name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toBeDefined();
    }
  });

  it("rejects missing name", () => {
    const result = validatePlanInput({});
    expect(result.success).toBe(false);
  });

  it("rejects guestCountMin > guestCountMax", () => {
    const result = validatePlanInput({
      name: "X",
      guestCountMin: 100,
      guestCountMax: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects dressBrideCount > 5", () => {
    const result = validatePlanInput({ name: "X", dressBrideCount: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects negative dressBudgetCapYen", () => {
    const result = validatePlanInput({ name: "X", dressBudgetCapYen: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects basePrice exceeding sanity cap", () => {
    const result = validatePlanInput({ name: "X", basePrice: 999_999_999 });
    expect(result.success).toBe(false);
  });

  it("coerces numeric strings", () => {
    const result = validatePlanInput({
      name: "X",
      basePrice: "3000000",
      dressBrideCount: "2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.basePrice).toBe(3000000);
      expect(result.data.dressBrideCount).toBe(2);
    }
  });

  it("preserves id when present (update path)", () => {
    const result = validatePlanInput({
      id: "a1b2c3d4-1234-4abc-89de-1234567890ab",
      name: "X",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("a1b2c3d4-1234-4abc-89de-1234567890ab");
    }
  });

  it("rejects invalid uuid for id", () => {
    const result = validatePlanInput({ id: "not-a-uuid", name: "X" });
    expect(result.success).toBe(false);
  });
});

/* --- Display logic: structured > note > legacy --------------------------- */

interface PlanForDisplay {
  dressAllowance: string | null;
  dressAllowanceNote: string | null;
  dressBrideCount: number | null;
  dressGroomCount: number | null;
  dressBudgetCapYen: number | null;
}

// Mirror of formatDressSummary in plan-section.tsx, kept here as a pure
// function so the display contract is testable without mounting React.
function formatDressSummary(plan: PlanForDisplay): {
  primary: string | null;
  note: string | null;
} {
  const parts: string[] = [];
  if (plan.dressBrideCount != null) parts.push(`新婦${plan.dressBrideCount}着`);
  if (plan.dressGroomCount != null) parts.push(`新郎${plan.dressGroomCount}着`);
  let primary: string | null = parts.length > 0 ? parts.join(" + ") : null;
  if (plan.dressBudgetCapYen != null) {
    const man = Math.round(plan.dressBudgetCapYen / 10000);
    const cap = `¥${man}万まで`;
    primary = primary ? `${primary} / ${cap}` : cap;
  }
  const note =
    plan.dressAllowanceNote ?? (primary ? null : plan.dressAllowance);
  return { primary, note };
}

describe("formatDressSummary", () => {
  it("renders structured fields as compact summary", () => {
    expect(
      formatDressSummary({
        dressAllowance: null,
        dressAllowanceNote: null,
        dressBrideCount: 2,
        dressGroomCount: 1,
        dressBudgetCapYen: 800_000,
      }),
    ).toEqual({ primary: "新婦2着 + 新郎1着 / ¥80万まで", note: null });
  });

  it("falls back to dressAllowanceNote when no structured fields", () => {
    expect(
      formatDressSummary({
        dressAllowance: null,
        dressAllowanceNote: "提携ブランドのみ含む",
        dressBrideCount: null,
        dressGroomCount: null,
        dressBudgetCapYen: null,
      }),
    ).toEqual({ primary: null, note: "提携ブランドのみ含む" });
  });

  it("falls back to legacy dressAllowance when nothing else is set", () => {
    expect(
      formatDressSummary({
        dressAllowance: "新婦2着+新郎1着で80万円程度",
        dressAllowanceNote: null,
        dressBrideCount: null,
        dressGroomCount: null,
        dressBudgetCapYen: null,
      }),
    ).toEqual({ primary: null, note: "新婦2着+新郎1着で80万円程度" });
  });

  it("returns null/null when nothing is set", () => {
    expect(
      formatDressSummary({
        dressAllowance: null,
        dressAllowanceNote: null,
        dressBrideCount: null,
        dressGroomCount: null,
        dressBudgetCapYen: null,
      }),
    ).toEqual({ primary: null, note: null });
  });

  it("prefers structured note over legacy free-text when both exist", () => {
    expect(
      formatDressSummary({
        dressAllowance: "古い説明",
        dressAllowanceNote: "新しい補足",
        dressBrideCount: 2,
        dressGroomCount: null,
        dressBudgetCapYen: null,
      }),
    ).toEqual({ primary: "新婦2着", note: "新しい補足" });
  });

  it("renders only budget cap when bride/groom counts are absent", () => {
    expect(
      formatDressSummary({
        dressAllowance: null,
        dressAllowanceNote: null,
        dressBrideCount: null,
        dressGroomCount: null,
        dressBudgetCapYen: 500_000,
      }),
    ).toEqual({ primary: "¥50万まで", note: null });
  });
});
