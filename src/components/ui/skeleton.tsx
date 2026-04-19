import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  // X-8: swap `animate-pulse` (opacity flip) for the shimmer sweep
  // defined in globals.css. bg-muted stays as the baseline fill so any
  // prefers-reduced-motion users still see a sensible placeholder.
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
