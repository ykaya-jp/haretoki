"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveAnswer } from "@/server/actions/checklist";
import type { ChecklistPresetItem } from "@/lib/checklist-presets";
import { toast } from "sonner";

type AnswerStatus = "yes" | "no" | "unknown" | null;
type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * W21-2 inline save indicator. Lives in the upper-right of each row
 * so couples get an immediate "残しています…→残しました" reassurance
 * without the modal weight of a Sonner toast for every keystroke.
 * `idle` renders nothing — the indicator only shows up when the row
 * has activity, keeping the form quiet at rest.
 */
function SaveStatusBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        残しています
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] tabular-nums text-[color-mix(in_oklab,var(--success,#22c55e)_70%,var(--foreground))]"
        aria-live="polite"
      >
        <Check className="h-3 w-3" aria-hidden="true" />
        残しました
      </span>
    );
  }
  return (
    <span className="text-[11px] tabular-nums text-destructive">
      残せませんでした
    </span>
  );
}

interface Answer {
  status: AnswerStatus;
  memo: string | null;
  numberValue: number | null;
  photoUrls: string[];
}

interface GroupedCategory {
  category: string;
  label: string;
  subcategories: Array<{
    subcategory: string;
    items: ChecklistPresetItem[];
  }>;
}

interface VenueChecklistInputViewProps {
  venueId: string;
  grouped: GroupedCategory[];
  initialAnswers: Record<string, { status: string | null; memo: string | null; numberValue: number | null; photoUrls: string[] }>;
}

interface SavePatch {
  status?: AnswerStatus;
  memo?: string | null;
  numberValue?: number | null;
  photoUrls?: string[];
}

/** Single item row — handles debounced save */
function ChecklistItemRow({
  venueId,
  item,
  initialAnswer,
}: {
  venueId: string;
  item: ChecklistPresetItem;
  initialAnswer?: Answer;
}) {
  const [, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (patch: SavePatch) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Flip to "saving" the moment a tap / keystroke arrives so the
      // user sees feedback during the 500ms debounce window — without
      // it the row stays silent and the eventual "saved" badge feels
      // disconnected from the action that triggered it.
      setSaveState("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          const result = await saveAnswer(venueId, item.id, patch);
          if (!result.success) {
            setSaveState("error");
            toast.error("うまく残せませんでした");
            return;
          }
          setSaveState("saved");
          // 1.5s is short enough that a fast follow-up edit re-arms the
          // "saving" state cleanly; long enough to register as ack.
          savedTimerRef.current = setTimeout(() => setSaveState("idle"), 1500);
        });
      }, 500);
    },
    [venueId, item.id]
  );

  if (item.type === "yesno") {
    const current = (initialAnswer?.status as AnswerStatus) ?? null;
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-snug">{item.question}</p>
          <SaveStatusBadge state={saveState} />
        </div>
        <div className="flex gap-2">
          {(["yes", "no", "unknown"] as const).map((val) => {
            const labels: Record<typeof val, string> = {
              yes: "はい ○",
              no: "いいえ ×",
              unknown: "未確認 —",
            };
            const isSelected = current === val;
            return (
              <button
                key={val}
                className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg border text-sm transition-colors active:scale-[0.98] ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground active:bg-muted"
                }`}
                onClick={() => debouncedSave({ status: isSelected ? null : val })}
              >
                {labels[val]}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (item.type === "memo") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-snug">{item.question}</p>
          <SaveStatusBadge state={saveState} />
        </div>
        <textarea
          rows={2}
          defaultValue={initialAnswer?.memo ?? ""}
          placeholder="メモを入力..."
          className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            debouncedSave({ memo: e.target.value })
          }
        />
      </div>
    );
  }

  if (item.type === "number") {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-snug">{item.question}</p>
          <SaveStatusBadge state={saveState} />
        </div>
        <input
          type="number"
          defaultValue={initialAnswer?.numberValue ?? ""}
          placeholder="数値を入力..."
          className="w-full rounded-md border border-border bg-card px-3 py-2 tabular-nums text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            debouncedSave({
              numberValue: e.target.value ? Number(e.target.value) : null,
            })
          }
        />
      </div>
    );
  }

  if (item.type === "photo") {
    return (
      <div className="space-y-1.5">
        <p className="text-sm leading-snug">{item.question}</p>
        {initialAnswer?.photoUrls && initialAnswer.photoUrls.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {initialAnswer.photoUrls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={url}
                alt=""
                className="h-16 w-16 rounded-md object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">式場詳細ページから写真を追加できます</p>
        )}
      </div>
    );
  }

  return null;
}

export function VenueChecklistInputView({
  venueId,
  grouped,
  initialAnswers,
}: VenueChecklistInputViewProps) {
  return (
    // W21-2: lift the page rhythm from `space-y-4` (16px) to `space-y-5`
    // (20px) so the editorial breathing room inside cards (px-4 py-4)
    // stops competing with the inter-card gap. Item-level rhythm goes
    // 4 → 5 to match.
    <div className="space-y-5">
      {grouped.map((group) => (
        <div key={group.category} className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">{group.label}</h3>
          </div>
          <div className="divide-y divide-border">
            {group.subcategories.map((sub) => (
              <div key={sub.subcategory} className="px-4 py-4">
                <p className="mb-3 text-xs font-medium text-muted-foreground">{sub.subcategory}</p>
                <div className="space-y-5">
                  {sub.items.map((item) => {
                    const raw = initialAnswers[item.id];
                    const answer: Answer | undefined = raw
                      ? {
                          status: raw.status as AnswerStatus,
                          memo: raw.memo,
                          numberValue: raw.numberValue,
                          photoUrls: raw.photoUrls,
                        }
                      : undefined;
                    return (
                      <ChecklistItemRow
                        key={item.id}
                        venueId={venueId}
                        item={item}
                        initialAnswer={answer}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
