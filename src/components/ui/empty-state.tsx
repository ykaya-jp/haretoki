import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
        <Icon className="h-7 w-7 text-[var(--gold-warm)]" />
      </div>
      <div className="max-w-[280px] space-y-2">
        <h3 className="font-serif text-base font-light tracking-wide">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className={cn(
            buttonVariants({ variant: "default" }),
            "rounded-full px-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          )}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
