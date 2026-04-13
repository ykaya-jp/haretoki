import { Sparkles, Receipt, Users, ClipboardCheck, BarChart3, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type InsightType = "estimate" | "partner" | "visit" | "comparison" | "reminder";

interface AIInsightCardProps {
  type: InsightType;
  title: string;
  body: string;
  actions: { label: string; href: string }[];
}

const INSIGHT_CONFIG: Record<InsightType, { icon: LucideIcon; borderColor: string }> = {
  estimate: { icon: Receipt, borderColor: "border-l-[var(--gold-warm)]" },
  partner: { icon: Users, borderColor: "border-l-primary" },
  visit: { icon: ClipboardCheck, borderColor: "border-l-[var(--success)]" },
  comparison: { icon: BarChart3, borderColor: "border-l-secondary" },
  reminder: { icon: Bell, borderColor: "border-l-muted-foreground" },
};

export function AIInsightCard({ type, title, body, actions }: AIInsightCardProps) {
  const config = INSIGHT_CONFIG[type];

  return (
    <div
      role="article"
      aria-label={title}
      className={cn(
        "rounded-lg border-l-[3px] bg-[var(--gold-subtle)] p-4",
        config.borderColor
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" />
        <span className="text-xs font-semibold tracking-[0.02em] text-[var(--gold-warm)]">
          {title}
        </span>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-foreground">{body}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="inline-flex h-8 items-center rounded-full border border-border bg-card px-3 text-sm transition-colors hover:bg-muted active:scale-95"
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
