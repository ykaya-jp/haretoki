"use client";

import { useCallback, useRef, useTransition } from "react";
import { saveAnswer } from "@/server/actions/checklist";
import type { ChecklistPresetItem } from "@/lib/checklist-presets";
import { toast } from "sonner";

type AnswerStatus = "yes" | "no" | "unknown" | null;

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (patch: SavePatch) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        startTransition(async () => {
          const result = await saveAnswer(venueId, item.id, patch);
          if (!result.success) {
            toast.error("保存できませんでした");
          }
        });
      }, 500);
    },
    [venueId, item.id]
  );

  if (item.type === "yesno") {
    const current = (initialAnswer?.status as AnswerStatus) ?? null;
    return (
      <div className="space-y-1.5">
        <p className="text-sm leading-snug">{item.question}</p>
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
        <p className="text-sm leading-snug">{item.question}</p>
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
        <p className="text-sm leading-snug">{item.question}</p>
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
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.category} className="rounded-lg border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h3 className="font-medium">{group.label}</h3>
          </div>
          <div className="divide-y divide-border">
            {group.subcategories.map((sub) => (
              <div key={sub.subcategory} className="px-4 py-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">{sub.subcategory}</p>
                <div className="space-y-4">
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
