"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * W20-4: surface the result of an invitation consume on /home.
 *
 * `/invite/[token]/page.tsx` redirects partners here with `?invited=1`
 * (and `?discarded=<n>` when the consume swept away their auto-created
 * empty project as part of the merge — see `consumeInvitationLink` for
 * the auto-discard rule). This component reads those params on mount,
 * shows the matching Sonner toast, and rewrites the URL so a refresh
 * doesn't fire the toast again.
 *
 * Why a separate client component (rather than wiring searchParams into
 * `HomePage` directly): keeps the page a pure Server Component and
 * isolates the one-shot URL-cleanup side effect to a leaf that's easy to
 * mount/unmount. Renders nothing.
 */
export function InvitationArrivalToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // Strict-mode double-mount in dev would otherwise fire the toast twice.
  // We don't rely on the URL cleanup alone because router.replace is
  // asynchronous and the second mount can read the same params before
  // the replace lands.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (searchParams.get("invited") !== "1") return;
    firedRef.current = true;

    const discardedRaw = searchParams.get("discarded");
    const discarded = discardedRaw
      ? Math.max(0, Number.parseInt(discardedRaw, 10) || 0)
      : 0;

    if (discarded > 0) {
      toast.success("ふたりで一緒に、ここで進めていきましょう", {
        description:
          "以前に残っていた空の式場さがしは整理しました。記録は失われていません。",
        duration: 6500,
      });
    } else {
      toast.success("ふたりで一緒に、ここで進めていきましょう", {
        duration: 5000,
      });
    }

    // Strip the one-shot params so a hard refresh doesn't re-toast and
    // copy/paste of the URL into chat doesn't show the recipient a stale
    // celebration. Keep any other params the page might rely on.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("invited");
    next.delete("discarded");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}
