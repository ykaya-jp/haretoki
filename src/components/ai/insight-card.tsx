import { Sparkles, Receipt, Users, ClipboardCheck, BarChart3, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PrefetchLink } from "@/components/ui/prefetch-link";
import type { LucideIcon } from "lucide-react";

type InsightType = "estimate" | "partner" | "visit" | "comparison" | "reminder";

interface AIInsightCardProps {
  type: InsightType;
  title: string;
  body: string;
  actions: { label: string; href: string }[];
  /**
   * R-4 Expire design. Age in days since generation:
   *   0-2  : fully vivid
   *   3-6  : fades (opacity 0.7) + subtle "少し前の気づき" eyebrow
   *   >=7  : should be hidden by caller (archived to /coach/insights)
   */
  ageDays?: number;
}

const INSIGHT_CONFIG: Record<InsightType, { icon: LucideIcon; borderColor: string }> = {
  estimate: { icon: Receipt, borderColor: "border-l-[var(--gold-warm)]" },
  partner: { icon: Users, borderColor: "border-l-primary" },
  visit: { icon: ClipboardCheck, borderColor: "border-l-[var(--success)]" },
  comparison: { icon: BarChart3, borderColor: "border-l-secondary" },
  reminder: { icon: Bell, borderColor: "border-l-muted-foreground" },
};

export function AIInsightCard({
  type,
  title,
  body,
  actions,
  ageDays,
}: AIInsightCardProps) {
  const config = INSIGHT_CONFIG[type];
  const isAging = (ageDays ?? 0) >= 3;

  return (
    <div
      role="article"
      aria-label={title}
      className={cn(
        "rounded-2xl border border-border/60 border-l-[3px] bg-card p-6 transition-opacity",
        config.borderColor,
        isAging && "opacity-70",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {/* Sparkles icon = AI signifier. Viz Phase 1 で唯一残す gold 点。
            背景ラウンド bubble と title の gold は削除して 1 点に絞る。 */}
        <Sparkles aria-hidden="true" className="h-4 w-4 text-[var(--gold-warm)]" strokeWidth={1.5} />
        <h3 className="text-eyebrow text-foreground">
          {isAging ? "少し前の気づき" : title}
        </h3>
      </div>
      {isAging && (
        <p className="mb-2 text-[13px] font-medium leading-relaxed text-foreground">
          {title}
        </p>
      )}
      <p className="mb-4 text-body text-foreground">{body}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <PrefetchLink
              key={action.href}
              href={action.href}
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "rounded-full px-4 transition-[transform,background-color] duration-200 active:scale-[0.98] active:bg-[var(--gold-subtle)]/60",
              )}
            >
              {action.label}
            </PrefetchLink>
          ))}
        </div>
      )}
    </div>
  );
}
