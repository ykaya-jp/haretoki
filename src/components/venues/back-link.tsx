"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Venue 詳細の breadcrumb masthead。戻るボタン + HARETOKI · Venue prefix。
 * 戻るは native history を優先し、無ければ /explore にフォールバック。
 */
export function VenueDetailBackLink() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/explore");
    }
  };

  return (
    <p className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
        aria-label="戻る"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        Back
      </button>
      <span aria-hidden="true" className="opacity-30">/</span>
      <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
      <span aria-hidden="true" className="opacity-30">·</span>
      <span>Venue</span>
    </p>
  );
}
