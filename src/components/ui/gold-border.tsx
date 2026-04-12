import { cn } from "@/lib/utils";

export function GoldBorder({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative p-[1px] rounded-2xl bg-gradient-to-br from-[var(--gold-warm)]/60 via-transparent to-[var(--gold-warm)]/60", className)}>
      <div className="bg-card rounded-2xl h-full">
        {children}
      </div>
    </div>
  );
}
