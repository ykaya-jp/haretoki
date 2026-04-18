"use client";

import type { ComparisonMatrix } from "@/server/actions/checklist";
import { ComparisonGrid } from "./comparison-grid";
import { ComparisonMobileSnapper } from "./comparison-mobile-snapper";

/**
 * Responsive wrapper — picks between the desktop CSS-Grid board and the
 * mobile snap carousel via Tailwind's md: breakpoint. Both subcomponents
 * are client components already (scroll sync, expand/collapse), so
 * rendering both trees at once is fine — CSS hides one at each breakpoint.
 *
 * Kept as a thin wrapper so the page.tsx can stay a pure Server Component.
 */
export function ComparisonBoard({ matrix }: { matrix: ComparisonMatrix }) {
  return (
    <>
      <div className="md:hidden">
        <ComparisonMobileSnapper matrix={matrix} />
      </div>
      <div className="hidden md:block">
        <ComparisonGrid matrix={matrix} />
      </div>
    </>
  );
}
