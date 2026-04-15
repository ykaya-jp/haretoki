"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function VenueDetailBackLink() {
  const router = useRouter();

  const handleBack = () => {
    // Prefer native history so filter state / scroll position on the referrer
    // page is preserved. Fall back to /explore if there's no history entry
    // (e.g., link opened in a new tab).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/explore");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground active:opacity-70"
      aria-label="戻る"
    >
      <ChevronLeft className="h-4 w-4" />
      戻る
    </button>
  );
}
