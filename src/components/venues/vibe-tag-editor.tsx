"use client";

import { useOptimistic, useTransition, useState } from "react";
import { cn } from "@/lib/utils";
import { VIBE_TAGS } from "@/lib/vibe-tags";
import { updateVenueVibeTags } from "@/server/actions/venue-vibe";
import { showToast } from "@/lib/toast";

interface VibeTagEditorProps {
  venueId: string;
  initialTags: string[];
}

export function VibeTagEditor({ venueId, initialTags }: VibeTagEditorProps) {
  const [localTags, setLocalTags] = useState<string[]>(initialTags);
  const [optimisticTags, setOptimisticTags] = useOptimistic(localTags);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    const next = optimisticTags.includes(id)
      ? optimisticTags.filter((t) => t !== id)
      : [...optimisticTags, id];
    startTransition(async () => {
      setOptimisticTags(next);
    });
    setLocalTags(next);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateVenueVibeTags(venueId, localTags);
      if (result.success) {
        showToast("success", "気分タグを保存しました");
      } else {
        showToast("error", result.error ?? "保存に失敗しました");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2
        className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-[-0.005em] text-foreground"
        aria-label="この式場の気分"
      >
        この式場の気分
      </h2>
      <p className="mt-1 text-[11.5px] text-muted-foreground">
        雰囲気に合うタグを選んでください
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {VIBE_TAGS.map((tag) => {
          const active = optimisticTags.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(tag.id)}
              className={cn(
                "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[13px] transition active:scale-[0.98]",
                active
                  ? "border-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)] bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                  : "border-border bg-background text-foreground hover:bg-muted/60",
              )}
            >
              <span aria-hidden="true">{tag.emoji}</span>
              {tag.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary text-[13.5px] font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? "保存中…" : "保存する"}
      </button>
    </section>
  );
}
