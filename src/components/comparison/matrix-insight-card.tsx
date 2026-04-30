"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import type { MatrixInsight } from "@/server/actions/matrix-insight";

interface MatrixInsightCardProps {
  insight: MatrixInsight | null;
}

/** AI analysis card for the comparison board (CMP-5). Gold-subtle background + 3px gold left border + Sparkles icon. */
export function MatrixInsightCard({ insight }: MatrixInsightCardProps) {
  if (!insight) return null;

  return (
    <div
      role="article"
      aria-label="AIコーチからのひとこと"
      className={cn(
        "rounded-2xl border border-border/60 border-l-[3px] p-5",
        "border-l-[var(--gold-warm)] bg-[var(--gold-subtle)]",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles
          aria-hidden="true"
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.5}
        />
        <h3 className="text-eyebrow text-foreground">AIコーチからのひとこと</h3>
      </div>
      <p className="mb-4 text-body text-foreground">{insight.summary}</p>
      {insight.nextActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {insight.nextActions.map((label) => (
            <PrefetchLink
              key={label}
              href="/coach"
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "rounded-full px-4 transition-[transform,background-color] duration-200 active:scale-[0.98] active:bg-[var(--gold-subtle)]/60",
              )}
            >
              {label}
            </PrefetchLink>
          ))}
        </div>
      )}
    </div>
  );
}
