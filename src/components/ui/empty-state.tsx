import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GoldSparkle } from "@/components/ui/gold-sparkle";
import { SeasonalMotif } from "@/components/ui/seasonal-motif";
import { VenueImage } from "@/components/ui/venue-image";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  imageUrl?: string;
  /** Alt text for the empty-state illustration. Pass "" only if the
   *  image is purely decorative and the title conveys the same meaning. */
  imageAlt?: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  imageUrl,
  imageAlt,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      {imageUrl ? (
        <div
          className="relative aspect-[3/2] w-full max-w-xs overflow-hidden rounded-[var(--r-lg)] shadow-[var(--shadow-card)]"
        >
          <VenueImage
            src={imageUrl}
            alt={imageAlt ?? ""}
            fill
            sizes="(max-width: 640px) 80vw, 320px"
            priority
            className="object-cover"
          />
        </div>
      ) : (
        // Subtle gold hairline ring around the icon — 48×48 outer (h-12 w-12)
        // with a 0.5px gold-subtle ring. Icon itself sits in the center in
        // gold-warm. Box-shadow is used for the hairline because Tailwind's
        // `ring-[0.5px]` rounds up on some browsers.
        <div
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            boxShadow: "0 0 0 0.5px var(--gold-subtle)",
          }}
        >
          <Icon
            className="h-6 w-6 text-[var(--gold-warm)]"
            strokeWidth={1.5}
          />
        </div>
      )}
      <div className="max-w-[300px] space-y-2">
        <h3 className="text-h3 font-serif font-extralight">{title}</h3>
        <p className="text-body text-muted-foreground">{description}</p>
      </div>
      {/* Decorative three-dot constellation — evocative, not noisy.
          A small seasonal motif sits alongside as a subtle brand flourish. */}
      <div
        aria-hidden="true"
        className="flex items-center justify-center gap-2 opacity-70"
      >
        <GoldSparkle className="h-2 w-2" />
        <GoldSparkle className="h-2.5 w-2.5" />
        <GoldSparkle className="h-2 w-2" />
        <SeasonalMotif size="sm" className="ml-1 opacity-60" />
      </div>
      {action && (
        <Link
          href={action.href}
          prefetch={true}
          className={cn(
            buttonVariants({ variant: "default" }),
            "rounded-full px-6 text-eyebrow shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
          )}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
