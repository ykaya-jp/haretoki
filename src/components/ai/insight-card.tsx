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
        "rounded-2xl border-l-[3px] bg-[var(--gold-subtle)] p-6",
        config.borderColor
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold-warm)]/10">
          <Sparkles className="h-3.5 w-3.5 text-[var(--gold-warm)]" />
        </div>
        <span className="text-xs font-semibold tracking-[0.04em] uppercase text-[var(--gold-warm)]">
          {title}
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-foreground">{body}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="inline-flex h-9 items-center rounded-full border border-[var(--gold-warm)]/20 bg-card px-4 text-sm font-medium text-[var(--gold-warm)] transition-colors hover:bg-[var(--gold-warm)]/5 active:scale-[0.97]"
            >
              {action.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
