"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

interface VenueDetailBackLinkProps {
  /**
   * "breadcrumb" (default): `Back / HARETOKI · Venue` の editorial masthead。
   * "compact": `← Back` だけの軽量戻るリンク。写真を画面上部に近づけたいときに使う。
   */
  variant?: "breadcrumb" | "compact";
}

export function VenueDetailBackLink({ variant = "breadcrumb" }: VenueDetailBackLinkProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/explore");
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleBack}
        className="-ml-1 inline-flex min-h-11 items-center gap-1 text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground hover:opacity-70"
        aria-label="戻る"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>
    );
  }

  return (
    <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
        aria-label="戻る"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>
      <span aria-hidden="true" className="opacity-30">/</span>
      <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
      <span aria-hidden="true" className="opacity-30">·</span>
      <span>Venue</span>
    </p>
  );
}
