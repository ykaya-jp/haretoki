import Image, { type ImageProps as NextImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * VenueImage — thin next/image wrapper that applies the unified
 * "Morning Light" photo tone across all venue/hero imagery.
 *
 * Source wedding photography varies wildly in tone (over-saturated reds,
 * cold fluorescent lobbies, mixed white balance). A single CSS `filter`
 * chain brings everything into the same warm, slightly desaturated,
 * cinematic luxury-hotel-brochure register.
 *
 * Tones:
 *  - "default" → `.photo-tone`       (venue cards, carousel non-hero,
 *                                     gallery thumbnails, empty-state art)
 *  - "hero"    → `.photo-tone-hero`  (active carousel photo, landing hero
 *                                     background — slightly richer)
 *  - "none"    → escape hatch (logos, icons, decorative SVGs — do NOT
 *                pass through a VenueImage in the first place)
 */
type Tone = "default" | "hero" | "none";

interface VenueImageProps extends Omit<NextImageProps, "className"> {
  className?: string;
  tone?: Tone;
}

const toneClass: Record<Tone, string> = {
  default: "photo-tone",
  hero: "photo-tone-hero",
  none: "",
};

export function VenueImage({
  className,
  tone = "default",
  ...imageProps
}: VenueImageProps) {
  // alt is required on NextImageProps (enforced by type) and is passed via
  // spread; the jsx-a11y plugin can't see it statically, so we disable here.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image className={cn(toneClass[tone], className)} {...imageProps} />;
}
