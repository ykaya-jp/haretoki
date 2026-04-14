import Link from "next/link";
import { Sparkles, Receipt, Users, ClipboardCheck, BarChart3, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[var(--gold-warm)]" strokeWidth={1.5} />
        </div>
        <span className="text-xs font-semibold tracking-[0.04em] uppercase text-[var(--gold-warm)]">
          {title}
        </span>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-foreground">{body}</p>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                buttonVariants({ variant: "secondary", size: "default" }),
                "rounded-full px-4",
              )}
            >
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
