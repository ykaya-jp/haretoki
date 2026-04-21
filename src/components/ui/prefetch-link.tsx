"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type CSSProperties, type ReactNode } from "react";

type PrefetchLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  style?: CSSProperties;
};

/**
 * Link wrapper that aggressively prefetches on hover, focus, and touchstart
 * to reduce perceived navigation latency on mobile and desktop.
 *
 * onTouchStart fires ~80-150ms before onClick on mobile, giving the router
 * a head-start on prefetching before the tap is fully registered.
 */
export function PrefetchLink({
  href,
  children,
  className,
  ariaLabel,
  prefetch = true,
  ...rest
}: PrefetchLinkProps) {
  const router = useRouter();

  const doPrefetch = useCallback(() => {
    if (typeof href !== "string") return;
    // Respect the user's Save-Data preference and slow connections.
    if (typeof navigator !== "undefined" && "connection" in navigator) {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (conn?.saveData) return;
      if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") return;
    }
    router.prefetch(href);
  }, [router, href]);

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={doPrefetch}
      onFocus={doPrefetch}
      onTouchStart={doPrefetch}
      className={className}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </Link>
  );
}
