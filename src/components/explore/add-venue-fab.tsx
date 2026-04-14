"use client";

import { Plus } from "lucide-react";
import { HaloTap } from "@/components/ui/halo-tap";

interface AddVenueFABProps {
  onClick: () => void;
}

/** Fixed gold FAB that opens the add-venue sheet. */
export function AddVenueFAB({ onClick }: AddVenueFABProps) {
  return (
    <HaloTap
      className="fixed right-4 z-40 rounded-full"
      style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="式場を追加"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--gold-warm)] shadow-[0_4px_16px_rgba(184,138,76,0.35)] transition-transform duration-150 active:scale-[0.95]"
      >
        <Plus className="h-6 w-6 text-white" strokeWidth={2} aria-hidden="true" />
      </button>
    </HaloTap>
  );
}
