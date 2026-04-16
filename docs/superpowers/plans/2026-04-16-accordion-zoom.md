# Accordion Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 候補画面の5タブを3タブに統合し、6次元スコアとチェックリスト項目をアコーディオン展開で自由に行き来できるようにする。

**Architecture:** 新しい `AccordionZoom` コンポーネントが既存の `DecisionMatrix` + `DimensionFocus` + `ChecklistComparison` を置換する。データは新しい `getUnifiedComparisonData()` Server Action で一括取得。DIMENSION_CHECKLIST_MAP 定数で80のチェック項目を6次元にマッピング。

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma, framer-motion, Tailwind CSS, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-16-accordion-zoom-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/dimension-checklist-map.ts` | DIMENSION_CHECKLIST_MAP 定数 + ヘルパー関数 |
| `src/server/actions/comparison.ts` | `getUnifiedComparisonData()` — スコア+チェックリストの統合データ取得 |
| `src/components/comparison/accordion-zoom.tsx` | 統合比較ビューのメインコンポーネント |
| `src/components/comparison/dimension-row.tsx` | 1次元行（折りたたみ/展開+チェック項目表示） |
| `tests/unit/lib/dimension-checklist-map.test.ts` | マッピング定数のテスト |
| `tests/unit/server/actions/comparison.test.ts` | 統合データ取得のテスト |

### Modified Files
| File | Change |
|------|--------|
| `src/components/candidates/candidates-view.tsx` | 5タブ→3タブ、Tab type変更、フィルタ状態lift |
| `src/app/(app)/candidates/page.tsx` | Tab type互換マッピング |

### Removed After Migration
| File | Reason |
|------|--------|
| `src/components/comparison/dimension-focus.tsx` | accordion-zoom に吸収 |
| `src/components/comparison/comparison-board.tsx` | 既に孤立（TODO付き） |

---

## Task 1: DIMENSION_CHECKLIST_MAP 定数

**Files:**
- Create: `src/lib/dimension-checklist-map.ts`
- Create: `tests/unit/lib/dimension-checklist-map.test.ts`
- Reference: `src/lib/constants.ts`, `src/lib/checklist-presets.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/unit/lib/dimension-checklist-map.test.ts
import { describe, it, expect } from "vitest";
import { getChecklistItemsForDimension, DIMENSION_CHECKLIST_MAP } from "@/lib/dimension-checklist-map";
import { TIER1_DIMENSIONS } from "@/lib/constants";
import { CHECKLIST_PRESETS } from "@/lib/checklist-presets";

describe("DIMENSION_CHECKLIST_MAP", () => {
  it("covers all TIER1_DIMENSIONS", () => {
    for (const dim of TIER1_DIMENSIONS) {
      expect(DIMENSION_CHECKLIST_MAP).toHaveProperty(dim);
    }
  });

  it("every mapped preset ID exists in CHECKLIST_PRESETS", () => {
    const allPresetIds = new Set(CHECKLIST_PRESETS.map((p) => p.id));
    for (const dim of TIER1_DIMENSIONS) {
      const items = getChecklistItemsForDimension(dim);
      for (const item of items) {
        expect(allPresetIds.has(item.id), `${item.id} not found in CHECKLIST_PRESETS`).toBe(true);
      }
    }
  });

  it("no preset is mapped to more than one dimension", () => {
    const seen = new Map<string, string>();
    for (const dim of TIER1_DIMENSIONS) {
      const items = getChecklistItemsForDimension(dim);
      for (const item of items) {
        const prev = seen.get(item.id);
        expect(prev, `${item.id} mapped to both ${prev} and ${dim}`).toBeUndefined();
        seen.set(item.id, dim);
      }
    }
  });

  it("returns empty array for reviews (no checklist items)", () => {
    expect(getChecklistItemsForDimension("reviews")).toEqual([]);
  });

  it("cuisine maps to cuisine_drink items", () => {
    const items = getChecklistItemsForDimension("cuisine");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.category === "cuisine_drink")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/dimension-checklist-map.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the mapping**

```typescript
// src/lib/dimension-checklist-map.ts
import type { Tier1Dimension } from "@/lib/constants";
import { CHECKLIST_PRESETS, type ChecklistCategory, type ChecklistPresetItem } from "@/lib/checklist-presets";

interface DimensionMapping {
  categories: ChecklistCategory[];
  excludeSubcategories?: string[];
  onlySubcategories?: string[];
}

export const DIMENSION_CHECKLIST_MAP: Record<Tier1Dimension, DimensionMapping> = {
  atmosphere: {
    categories: ["chapel", "banquet"],
  },
  hospitality: {
    categories: ["staff_estimate"],
    onlySubcategories: ["スタッフ"],
  },
  cuisine: {
    categories: ["cuisine_drink"],
  },
  cost: {
    categories: ["staff_estimate"],
    onlySubcategories: ["見積り"],
  },
  access: {
    categories: ["facility"],
  },
  reviews: {
    categories: [],
  },
};

const UNMAPPED_CATEGORY: Tier1Dimension = "atmosphere";

export function getChecklistItemsForDimension(dimension: Tier1Dimension): ChecklistPresetItem[] {
  const mapping = DIMENSION_CHECKLIST_MAP[dimension];
  if (mapping.categories.length === 0) return [];

  return CHECKLIST_PRESETS.filter((preset) => {
    if (!mapping.categories.includes(preset.category)) return false;
    if (mapping.onlySubcategories) {
      return mapping.onlySubcategories.includes(preset.subcategory ?? "");
    }
    if (mapping.excludeSubcategories) {
      return !mapping.excludeSubcategories.includes(preset.subcategory ?? "");
    }
    return true;
  });
}

export function getDimensionForPreset(presetId: string): Tier1Dimension {
  const preset = CHECKLIST_PRESETS.find((p) => p.id === presetId);
  if (!preset) return UNMAPPED_CATEGORY;

  for (const [dim, mapping] of Object.entries(DIMENSION_CHECKLIST_MAP) as [Tier1Dimension, DimensionMapping][]) {
    if (!mapping.categories.includes(preset.category)) continue;
    if (mapping.onlySubcategories && !mapping.onlySubcategories.includes(preset.subcategory ?? "")) continue;
    if (mapping.excludeSubcategories && mapping.excludeSubcategories.includes(preset.subcategory ?? "")) continue;
    return dim;
  }
  return UNMAPPED_CATEGORY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/dimension-checklist-map.test.ts`
Expected: PASS

- [ ] **Step 5: Fix "no preset mapped to more than one dimension" if it fails**

`dress_item` カテゴリは現在どの次元にもマッピングされていない。テストの「重複なし」は通るが、カバレッジの網羅性を確認する。`dress_item` は `atmosphere` に含めるか別途判断。現時点では未マッピングで問題なし（accordion-zoom でマッピングなし項目は「その他」セクションとして末尾に表示）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/dimension-checklist-map.ts tests/unit/lib/dimension-checklist-map.test.ts
git commit -m "feat: add DIMENSION_CHECKLIST_MAP — bridge score dimensions to checklist items"
```

---

## Task 2: Unified Comparison Server Action

**Files:**
- Create: `src/server/actions/comparison.ts`
- Create: `tests/unit/server/actions/comparison.test.ts`
- Reference: `src/server/actions/matrix.ts`, `src/server/actions/checklist.ts`

- [ ] **Step 1: Define types and write the test**

```typescript
// tests/unit/server/actions/comparison.test.ts
import { describe, it, expect } from "vitest";
import type { UnifiedComparisonData, DimensionWithChecklist } from "@/server/actions/comparison";

describe("UnifiedComparisonData type", () => {
  it("DimensionWithChecklist has required fields", () => {
    const dim: DimensionWithChecklist = {
      id: "atmosphere",
      label: "雰囲気",
      scores: { "venue-1": 4.2, "venue-2": 3.5 },
      winnerId: "venue-1",
      checklistItems: [
        {
          itemId: "chapel.interior.decor-style",
          question: "全体の内装・装飾スタイル",
          type: "yesno",
          answers: {
            "venue-1": { status: "yes", memo: null },
            "venue-2": { status: "no", memo: "やや暗い" },
          },
          hasDifference: true,
        },
      ],
      totalItems: 13,
      answeredItems: 1,
    };
    expect(dim.id).toBe("atmosphere");
    expect(dim.checklistItems).toHaveLength(1);
    expect(dim.checklistItems[0].hasDifference).toBe(true);
  });
});
```

- [ ] **Step 2: Implement the Server Action**

```typescript
// src/server/actions/comparison.ts
"use server";

import { getMatrixData, type MatrixVenue, type MatrixData } from "@/server/actions/matrix";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { getChecklistItemsForDimension } from "@/lib/dimension-checklist-map";
import type { ChecklistPresetItem } from "@/lib/checklist-presets";

export interface ChecklistItemAnswer {
  status: string | null;
  memo: string | null;
}

export interface ChecklistItemComparison {
  itemId: string;
  question: string;
  type: string;
  answers: Record<string, ChecklistItemAnswer>;
  hasDifference: boolean;
}

export interface DimensionWithChecklist {
  id: string;
  label: string;
  scores: Record<string, number | null>;
  winnerId: string | null;
  checklistItems: ChecklistItemComparison[];
  totalItems: number;
  answeredItems: number;
}

export interface UnifiedComparisonData {
  venues: MatrixVenue[];
  dimensions: DimensionWithChecklist[];
  totalScore: Record<string, number | null>;
  costWinnerId: string | null;
  unmappedItems: ChecklistItemComparison[];
}

export async function getUnifiedComparisonData(): Promise<UnifiedComparisonData> {
  const matrixData = await getMatrixData();
  const { venues, winners } = matrixData;

  if (venues.length === 0) {
    return {
      venues: [],
      dimensions: [],
      totalScore: {},
      costWinnerId: null,
      unmappedItems: [],
    };
  }

  const venueIds = venues.map((v) => v.id);

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Fetch all checklist answers for these venues in one query
  const answers = await prisma.venueChecklistAnswer.findMany({
    where: {
      venueId: { in: venueIds },
      projectChecklist: { projectId },
    },
    select: {
      venueId: true,
      itemId: true,
      status: true,
      memo: true,
    },
  });

  // Index answers by itemId → venueId
  const answerIndex = new Map<string, Map<string, ChecklistItemAnswer>>();
  for (const a of answers) {
    if (!answerIndex.has(a.itemId)) answerIndex.set(a.itemId, new Map());
    answerIndex.get(a.itemId)!.set(a.venueId, {
      status: a.status,
      memo: a.memo,
    });
  }

  function buildChecklistItems(presets: ChecklistPresetItem[]): ChecklistItemComparison[] {
    return presets.map((preset) => {
      const itemAnswers: Record<string, ChecklistItemAnswer> = {};
      const statuses: (string | null)[] = [];

      for (const vid of venueIds) {
        const ans = answerIndex.get(preset.id)?.get(vid) ?? { status: null, memo: null };
        itemAnswers[vid] = ans;
        statuses.push(ans.status);
      }

      const nonNull = statuses.filter((s) => s !== null);
      const hasDifference = nonNull.length >= 2 && new Set(nonNull).size > 1;

      return {
        itemId: preset.id,
        question: preset.question,
        type: preset.type,
        answers: itemAnswers,
        hasDifference,
      };
    });
  }

  const mappedItemIds = new Set<string>();

  const dimensions: DimensionWithChecklist[] = TIER1_DIMENSIONS.map((dimId) => {
    const presets = getChecklistItemsForDimension(dimId);
    presets.forEach((p) => mappedItemIds.add(p.id));

    const checklistItems = buildChecklistItems(presets);
    const answeredCount = checklistItems.filter((item) =>
      Object.values(item.answers).some((a) => a.status !== null),
    ).length;

    const scores: Record<string, number | null> = {};
    for (const v of venues) {
      scores[v.id] = v.scoresByDimension[dimId] ?? null;
    }

    return {
      id: dimId,
      label: DIMENSION_LABELS[dimId] ?? dimId,
      scores,
      winnerId: winners[dimId] ?? null,
      checklistItems,
      totalItems: presets.length,
      answeredItems: answeredCount,
    };
  });

  // Unmapped items (e.g., dress_item) go to a separate section
  const { CHECKLIST_PRESETS } = await import("@/lib/checklist-presets");
  const unmappedPresets = CHECKLIST_PRESETS.filter((p) => !mappedItemIds.has(p.id));
  const unmappedItems = buildChecklistItems(unmappedPresets);

  const totalScore: Record<string, number | null> = {};
  for (const v of venues) {
    totalScore[v.id] = v.totalScore;
  }

  return {
    venues,
    dimensions,
    totalScore,
    costWinnerId: winners.cost_value ?? null,
    unmappedItems,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/server/actions/comparison.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/server/actions/comparison.ts tests/unit/server/actions/comparison.test.ts
git commit -m "feat: getUnifiedComparisonData — merge score matrix + checklist answers"
```

---

## Task 3: DimensionRow Component

**Files:**
- Create: `src/components/comparison/dimension-row.tsx`

- [ ] **Step 1: Implement DimensionRow**

This is a client component that renders one dimension as a collapsible row. Collapsed: shows dimension label + star scores. Expanded: shows checklist items below.

```typescript
// src/components/comparison/dimension-row.tsx
"use client";

import { useState } from "react";
import { ChevronRight, Check, X, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { DimensionWithChecklist } from "@/server/actions/comparison";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

function StarDisplay({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground text-xs">—</span>;
  const full = Math.round(score);
  return (
    <span className="inline-flex gap-px text-xs" aria-label={`${score}点`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? "text-[var(--gold-warm)]" : "text-border"}>★</span>
      ))}
    </span>
  );
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === "yes") return <Check className="h-4 w-4 text-[var(--success)]" />;
  if (status === "no") return <X className="h-4 w-4 text-destructive" />;
  if (status === "unknown") return <Minus className="h-4 w-4 text-muted-foreground" />;
  return <span className="text-muted-foreground text-xs">—</span>;
}

interface DimensionRowProps {
  dimension: DimensionWithChecklist;
  venueIds: string[];
  diffOnly: boolean;
  defaultExpanded?: boolean;
  isWinner?: boolean;
}

export function DimensionRow({ dimension, venueIds, diffOnly, defaultExpanded = false, isWinner }: DimensionRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const visibleItems = diffOnly
    ? dimension.checklistItems.filter((item) => item.hasDifference)
    : dimension.checklistItems;

  const hasItems = dimension.checklistItems.length > 0;

  return (
    <div className={cn("border-b border-border", isWinner && "bg-[rgba(201,168,76,0.04)]")}>
      {/* Dimension header row — always visible */}
      <button
        type="button"
        onClick={() => hasItems && setExpanded(!expanded)}
        disabled={!hasItems}
        className={cn(
          "grid w-full items-center gap-1 px-4 py-2.5 text-left transition-colors active:scale-[0.99]",
          hasItems && "cursor-pointer hover:bg-muted/30",
          !hasItems && "cursor-default",
        )}
        style={{ gridTemplateColumns: `100px repeat(${venueIds.length}, 1fr)` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {hasItems && (
            <motion.span
              animate={{ rotate: expanded ? 90 : 0 }}
              transition={{ duration: 0.2, ease: LUXURY_EASE }}
              className="text-[10px] text-[var(--gold-warm)]"
            >
              <ChevronRight className="h-3 w-3" />
            </motion.span>
          )}
          <span className="text-xs font-medium truncate">{dimension.label}</span>
          {hasItems && (
            <span className="text-[10px] text-muted-foreground">({dimension.totalItems})</span>
          )}
        </div>
        {venueIds.map((vid) => (
          <div key={vid} className="text-center">
            <StarDisplay score={dimension.scores[vid] ?? null} />
          </div>
        ))}
      </button>

      {/* Expanded checklist items */}
      <AnimatePresence>
        {expanded && visibleItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0, pointerEvents: "none" as const }}
            transition={{ duration: 0.2, ease: LUXURY_EASE }}
            className="overflow-hidden"
          >
            <div className="ml-4 border-l-2 border-[rgba(201,168,76,0.2)] pb-2">
              {visibleItems.map((item) => (
                <div
                  key={item.itemId}
                  className={cn(
                    "grid items-center gap-1 px-4 py-1.5",
                    item.hasDifference && "bg-[var(--gold-subtle)]/30",
                  )}
                  style={{ gridTemplateColumns: `100px repeat(${venueIds.length}, 1fr)` }}
                >
                  <span className="text-[11px] text-muted-foreground truncate" title={item.question}>
                    {item.question}
                  </span>
                  {venueIds.map((vid) => (
                    <div key={vid} className="flex justify-center">
                      <StatusIcon status={item.answers[vid]?.status ?? null} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/comparison/dimension-row.tsx
git commit -m "feat: DimensionRow — collapsible dimension with checklist drill-down"
```

---

## Task 4: AccordionZoom Main Component

**Files:**
- Create: `src/components/comparison/accordion-zoom.tsx`

- [ ] **Step 1: Implement AccordionZoom**

```typescript
// src/components/comparison/accordion-zoom.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getUnifiedComparisonData, type UnifiedComparisonData } from "@/server/actions/comparison";
import { getMatrixInsight, type MatrixInsight } from "@/server/actions/matrix-insight";
import { DimensionRow } from "@/components/comparison/dimension-row";
import { AIInsightCard } from "@/components/ai/insight-card";

const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;

export function AccordionZoom() {
  const [data, setData] = useState<UnifiedComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffOnly, setDiffOnly] = useState(false);
  const [insight, setInsight] = useState<MatrixInsight | null>(null);

  useEffect(() => {
    getUnifiedComparisonData()
      .then(setData)
      .finally(() => setLoading(false));
    getMatrixInsight()
      .then(setInsight)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.venues.length < 2) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          比較するには候補を2件以上追加してください
        </p>
        <Link
          href="/explore"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground active:scale-[0.98]"
        >
          式場を見てみる
        </Link>
      </div>
    );
  }

  const { venues, dimensions, totalScore, unmappedItems } = data;
  const venueIds = venues.map((v) => v.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: LUXURY_EASE }}
      className="space-y-4"
    >
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDiffOnly(!diffOnly)}
          className={cn(
            "min-h-[36px] rounded-full px-4 text-xs font-medium transition-colors active:scale-[0.97]",
            diffOnly
              ? "bg-[var(--gold-warm)] text-white"
              : "border border-border bg-card text-muted-foreground",
          )}
        >
          差分のみ
        </button>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {/* Sticky venue headers */}
        <div
          className="sticky top-0 z-10 grid items-center border-b border-border bg-card/95 backdrop-blur-sm px-4 py-3"
          style={{ gridTemplateColumns: `100px repeat(${venueIds.length}, 1fr)` }}
        >
          <div />
          {venues.map((v) => (
            <Link key={v.id} href={`/venues/${v.id}`} className="flex flex-col items-center gap-1 active:scale-[0.97]">
              <div className="h-9 w-9 overflow-hidden rounded-lg bg-muted">
                {v.photoUrl && (
                  <Image
                    src={v.photoUrl}
                    alt={v.name}
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <span className="max-w-[80px] truncate text-[11px] font-medium">{v.name}</span>
            </Link>
          ))}
        </div>

        {/* Total score row */}
        <div
          className="grid items-center px-4 py-2.5 border-b border-border bg-[rgba(201,168,76,0.06)]"
          style={{ gridTemplateColumns: `100px repeat(${venueIds.length}, 1fr)` }}
        >
          <span className="text-xs font-medium">総合</span>
          {venueIds.map((vid) => (
            <div key={vid} className="text-center font-[family-name:var(--font-geist)] text-base font-semibold tabular-nums text-[var(--gold-warm)]">
              {totalScore[vid]?.toFixed(1) ?? "—"}
            </div>
          ))}
        </div>

        {/* Dimension rows */}
        {dimensions.map((dim, i) => (
          <DimensionRow
            key={dim.id}
            dimension={dim}
            venueIds={venueIds}
            diffOnly={diffOnly}
            defaultExpanded={i === 0}
            isWinner={data.venues.length > 1 && dim.winnerId !== null}
          />
        ))}

        {/* Unmapped items (dress_item etc.) */}
        {unmappedItems.length > 0 && (
          <DimensionRow
            dimension={{
              id: "other",
              label: "その他",
              scores: Object.fromEntries(venueIds.map((vid) => [vid, null])),
              winnerId: null,
              checklistItems: unmappedItems,
              totalItems: unmappedItems.length,
              answeredItems: unmappedItems.filter((item) =>
                Object.values(item.answers).some((a) => a.status !== null),
              ).length,
            }}
            venueIds={venueIds}
            diffOnly={diffOnly}
          />
        )}
      </div>

      {/* AI Insight */}
      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.42, ease: LUXURY_EASE }}
        >
          <AIInsightCard
            type="comparison"
            title="AIコーチの分析"
            body={insight.body}
            actions={insight.actions ?? []}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors (check MatrixInsight import compatibility)

- [ ] **Step 3: Commit**

```bash
git add src/components/comparison/accordion-zoom.tsx
git commit -m "feat: AccordionZoom — unified coarse/fine comparison view"
```

---

## Task 5: Integrate into CandidatesView (5→3 tabs)

**Files:**
- Modify: `src/components/candidates/candidates-view.tsx`
- Modify: `src/app/(app)/candidates/page.tsx`

- [ ] **Step 1: Update Tab type and SEGMENTS**

In `candidates-view.tsx`, change:

```typescript
// OLD
type Tab = "shortlist" | "matrix" | "focus" | "checklist" | "decision";
// NEW
type Tab = "shortlist" | "compare" | "decision";
```

Update SEGMENTS:
```typescript
const SEGMENTS = [
  { id: "shortlist" as const, label: "候補" },
  {
    id: "compare" as const,
    label: "比べる",
    disabled: !canCompare,
    disabledHint: "候補を2件以上追加すると比べられます",
  },
  {
    id: "decision" as const,
    label: "決める",
    disabled: !canDecide,
    disabledHint: "候補を1件以上追加すると使えます",
  },
];
```

- [ ] **Step 2: Replace tab content**

Remove the `matrix`, `focus`, `checklist` tab branches from the AnimatePresence. Replace with single `compare` branch:

```tsx
{tab === "compare" && (
  <motion.div
    key="compare"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12, pointerEvents: "none" as const }}
    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
  >
    {canCompare ? (
      <AccordionZoom />
    ) : (
      <EmptyState
        icon={BarChart3}
        title="候補を2件以上集めると比べられます"
        description="式場を候補に入れると、ここで並べて見比べられます。"
        action={{ label: "式場を探す", href: "/explore" }}
      />
    )}
  </motion.div>
)}
```

- [ ] **Step 3: Remove old dynamic imports**

Remove these dynamic imports:
```typescript
// REMOVE:
const DecisionMatrix = dynamic(...)
const DimensionFocus = dynamic(...)
const ChecklistComparison = dynamic(...)
```

Add new import:
```typescript
import dynamic from "next/dynamic";
const AccordionZoom = dynamic(
  () => import("@/components/comparison/accordion-zoom").then((m) => m.AccordionZoom),
  { loading: TabFallback },
);
```

- [ ] **Step 4: Update candidates/page.tsx tab compat**

```typescript
// Tab compatibility mapping for old URLs
const TAB_COMPAT: Record<string, string> = {
  matrix: "compare",
  focus: "compare",
  checklist: "compare",
};
const rawTab = params.tab;
const initialTab = (rawTab && TAB_COMPAT[rawTab]) ? TAB_COMPAT[rawTab] as "shortlist" | "compare" | "decision" : rawTab as "shortlist" | "compare" | "decision" | undefined;
```

- [ ] **Step 5: Update all `?tab=matrix` links to `?tab=compare`**

Search and replace in: `insights.ts`, `coach.ts`, `editorial-hero.tsx`, `hero-nba.tsx`, `reflection-hint.tsx`

```
/candidates?tab=matrix → /candidates?tab=compare
/candidates?tab=checklist → /candidates?tab=compare
/candidates?tab=decision → /candidates?tab=decision (unchanged)
```

- [ ] **Step 6: Run lint + build**

Run: `npm run lint && npm run build`
Expected: 0 errors, build success

- [ ] **Step 7: Run full test suite**

Run: `npm test`
Expected: All pass (update any tests that reference old tab names)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: integrate accordion zoom — 5 tabs to 3, unified comparison"
```

---

## Task 6: Cleanup Deprecated Components

**Files:**
- Remove: `src/components/comparison/dimension-focus.tsx`
- Remove: `src/components/comparison/comparison-board.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "dimension-focus\|DimensionFocus\|comparison-board\|ComparisonBoard" src/ --include="*.tsx" --include="*.ts"`
Expected: No results (or only in files being deleted)

- [ ] **Step 2: Delete files**

```bash
rm src/components/comparison/dimension-focus.tsx
rm src/components/comparison/comparison-board.tsx
```

- [ ] **Step 3: Run build to confirm nothing breaks**

Run: `npm run build`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated dimension-focus and comparison-board"
```

---

## Task 7: E2E Smoke Test + Deploy

- [ ] **Step 1: Run lint + typecheck + unit tests**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: All pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Success

- [ ] **Step 3: Manual smoke in dev server**

Start: `npm run dev`
Check at http://localhost:3000/candidates:
1. 3タブ表示（候補/比べる/決める）
2. 「比べる」タブ → 全次元が星スコア付きで表示
3. 最初の次元（雰囲気）がデフォルト展開
4. 次元をタップ→展開/折りたたみ動作
5. 「差分のみ」トグルが機能
6. FavoriteFilter が0件でも表示（C1回帰なし）

- [ ] **Step 4: Push + Deploy**

```bash
git push origin develop
vercel --prod --yes
```

- [ ] **Step 5: Post-deploy verification**

Verify on https://haretoki.vercel.app:
- /candidates loads with 3 tabs
- /candidates?tab=compare opens 比べるタブ
- /candidates?tab=matrix (旧URL) も compare にマップ
