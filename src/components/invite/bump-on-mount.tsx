"use client";

import { useEffect } from "react";

/**
 * Fires a single POST to /invite/[token]/bump when the component mounts.
 * This bumps the guest session cookie (screenCount++, lastSeenAt) from the
 * Route Handler phase where cookies().set() is permitted. Server Components
 * cannot call cookies().set() in their render phase.
 */
export function BumpOnMount({ token }: { token: string }) {
  useEffect(() => {
    fetch(`/invite/${token}/bump`, { method: "POST" }).catch(() => {
      // Best-effort: bump failure does not affect the guest viewing experience.
    });
  }, [token]);

  return null;
}
