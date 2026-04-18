"use client";

import { DemoVenueCard } from "@/components/demo/demo-venue-card";
import { useDemoData } from "@/components/demo/demo-data-provider";

// /demo/venues — simplified "探す" list of the 3 mock venues.
export default function DemoVenuesPage() {
  const { venues } = useDemoData();
  return (
    <div className="space-y-6">
      <header className="space-y-1 pt-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-light tracking-[-0.01em]">
          式場を探す
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          モックの式場を3件用意しています。ハートをタップしてお気に入りに追加できます。
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {venues.map((venue) => (
          <DemoVenueCard key={venue.id} venue={venue} />
        ))}
      </div>
    </div>
  );
}
