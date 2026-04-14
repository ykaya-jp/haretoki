"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

/**
 * Range slider built on base-ui's Slider primitive.
 * Supports both single-value and dual-thumb (range) usage via the `value` prop
 * (pass `[min, max]` for a range). Styled to match the project's shadcn-style tokens.
 */
type SliderRootProps<V extends number | readonly number[]> =
  SliderPrimitive.Root.Props<V>;

function Slider<V extends number | readonly number[] = readonly number[]>({
  className,
  value,
  defaultValue,
  ...props
}: SliderRootProps<V>) {
  // Determine thumb count from value (controlled) or defaultValue (uncontrolled).
  const source = (value ?? defaultValue) as number | readonly number[] | undefined;
  const thumbCount = Array.isArray(source) ? source.length : 1;

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Control
        data-slot="slider-control"
        className="relative flex w-full h-11 items-center"
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-indicator"
            className="absolute h-full bg-primary"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }).map((_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            data-slot="slider-thumb"
            className="block size-5 shrink-0 rounded-full border-2 border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
