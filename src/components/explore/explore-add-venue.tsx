"use client";

import { useState } from "react";
import { AddVenueSheet } from "@/components/explore/add-venue-sheet";
import { AddVenueFAB } from "@/components/explore/add-venue-fab";

interface ExploreAddVenueProps {
  defaultOpen?: boolean;
}

/** Ties the FAB and the add-venue sheet to a single open state. */
export function ExploreAddVenue({ defaultOpen = false }: ExploreAddVenueProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <AddVenueSheet open={open} onOpenChange={setOpen} />
      <AddVenueFAB onClick={() => setOpen(true)} />
    </>
  );
}
