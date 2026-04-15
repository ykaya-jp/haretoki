"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ReactNode } from "react";

type PrefetchLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
};

/**
 * Link wrapper that aggressively prefetches on hover, focus, and touchstart
 * to reduce perceived navigation latency on mobile and desktop.
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
      className={className}
      aria-label={ariaLabel}
      {...rest}
    >
      {children}
    </Link>
  );
}
