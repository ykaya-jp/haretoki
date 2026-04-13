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
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Link href={action.href} className={cn(buttonVariants({ variant: "default" }))}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
