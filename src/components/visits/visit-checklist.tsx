"use client";

import { useState, useTransition, useCallback } from "react";
import { updateChecklistItemStatus } from "@/server/actions/visits";
import { Check, X, ChevronDown, MessageSquare, Camera, Loader2 } from "lucide-react";
import Image from "next/image";
import { addChecklistPhoto } from "@/server/actions/visits";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CHECKLIST_TEMPLATES } from "@/lib/checklist-templates";

interface ChecklistItem {
  id: string;
  item: string;
  category: string | null;
  status: string;
  memo: string | null;
  photoUrls: string[];
}

interface VisitChecklistProps {
  items: ChecklistItem[];
}

const CATEGORY_ORDER = ["chapel", "facility", "banquet", "dress_item", "staff_estimate", "cuisine_drink"] as const;

// Luxury easing: smooth deceleration (Aesop/Apple-inspired)
const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;
const COLLAPSE_TRANSITION = { duration: 0.7, ease: LUXURY_EASE };
const CHEVRON_TRANSITION = { duration: 0.6, ease: LUXURY_EASE };
const MEMO_TRANSITION = { duration: 0.6, ease: LUXURY_EASE };

function getCategoryLabel(category: string): string {
  return CHECKLIST_TEMPLATES[category]?.label ?? category;
}

export function VisitChecklist({ items }: VisitChecklistProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [expandedMemos, setExpandedMemos] = useState<Set<string>>(new Set());
  const [memoValues, setMemoValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of items) {
      if (item.memo) initial[item.id] = item.memo;
    }
    return initial;
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Group items by category
  const grouped = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const cat = item.category ?? "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  // Sort categories by predefined order
  const sortedCategories = [...grouped.keys()].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a as typeof CATEGORY_ORDER[number]);
    const bi = CATEGORY_ORDER.indexOf(b as typeof CATEGORY_ORDER[number]);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const toggleMemo = useCallback((itemId: string) => {
    setExpandedMemos(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleToggleCheck = (itemId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "unchecked" ? "yes" : currentStatus === "yes" ? "no" : "unchecked";
    startTransition(async () => {
      const memo = memoValues[itemId];
      await updateChecklistItemStatus(itemId, nextStatus as "unchecked" | "yes" | "no", memo);
      router.refresh();
    });
  };

  const handleMemoSave = (itemId: string) => {
    const memo = memoValues[itemId] ?? "";
    const item = items.find(i => i.id === itemId);
    // Dirty check: skip DB write when the textarea blurred without changes.
    // Normalize null↔"" so an untouched empty memo doesn't round-trip.
    if ((item?.memo ?? "") === memo) return;
    startTransition(async () => {
      await updateChecklistItemStatus(itemId, (item?.status ?? "unchecked") as "unchecked" | "yes" | "no", memo);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">見学の確認リスト</p>
      {sortedCategories.map((cat) => {
        const catItems = grouped.get(cat) ?? [];
        const checkedCount = catItems.filter(i => i.status !== "unchecked").length;
        const isExpanded = expandedCategories.has(cat);

        return (
          <div key={cat} className="rounded-xl border border-border overflow-hidden">
            {/* Category header */}
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              className="flex w-full min-h-[48px] items-center justify-between gap-3 bg-muted/30 px-4 py-3 text-left transition-colors duration-200 active:bg-muted"
            >
              <span className="text-sm font-medium">{getCategoryLabel(cat)}</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs tabular-nums rounded-full px-2 py-0.5",
                  checkedCount === catItems.length && catItems.length > 0
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                )}>
                  {checkedCount}/{catItems.length}
                </span>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={CHEVRON_TRANSITION}
                >
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </motion.div>
              </div>
            </button>

            {/* Category items */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={COLLAPSE_TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-border">
                    {catItems.map((item) => {
                      const memoExpanded = expandedMemos.has(item.id);
                      return (
                        <div key={item.id}>
                          <div className="flex items-center gap-3 px-4">
                            {/* 3-state toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleCheck(item.id, item.status)}
                              disabled={isPending}
                              className="flex h-12 w-12 shrink-0 items-center justify-center transition-transform duration-300 active:scale-90"
                              aria-label={`${item.item}: ${item.status === "yes" ? "よかった" : item.status === "no" ? "気になった" : "まだ見ていない"}`}
                            >
                              <div className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors duration-200",
                                item.status === "yes" ? "border-green-500 bg-green-500 text-white" :
                                item.status === "no" ? "border-red-400 bg-red-50 text-red-500" :
                                "border-muted-foreground/30 bg-card"
                              )}>
                                {item.status === "yes" && <Check className="h-4 w-4" />}
                                {item.status === "no" && <X className="h-4 w-4" />}
                              </div>
                            </button>

                            {/* Item text + memo toggle */}
                            <div className="flex flex-1 items-center justify-between min-h-[48px] py-2">
                              <span className={cn(
                                "text-sm leading-snug",
                                item.status === "yes" && "text-muted-foreground"
                              )}>
                                {item.item}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleMemo(item.id)}
                                className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                                  memoExpanded || item.memo ? "text-primary" : "text-muted-foreground/50",
                                  "active:bg-muted"
                                )}
                                aria-label="メモ"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Memo input */}
                          <AnimatePresence>
                            {memoExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={MEMO_TRANSITION}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-3 pl-16 space-y-2">
                                  <textarea
                                    value={memoValues[item.id] ?? ""}
                                    onChange={(e) => setMemoValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    onBlur={() => handleMemoSave(item.id)}
                                    placeholder="気づいたことを書いておく"
                                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    rows={2}
                                  />
                                  {/* Photo thumbnails */}
                                  {item.photoUrls.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                      {item.photoUrls.map((url, idx) => (
                                        <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden">
                                          <Image src={url} alt="" fill className="object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {/* Photo upload */}
                                  <PhotoUploadButton itemId={item.id} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function PhotoUploadButton({ itemId }: { itemId: string }) {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      await addChecklistPhoto(itemId, formData);
      router.refresh();
    } catch {
      toast.error("写真をうまく追加できませんでした");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground cursor-pointer transition-colors duration-200 hover:bg-muted active:scale-95">
      {uploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Camera className="h-3.5 w-3.5" />
      )}
      {uploading ? "送信中..." : "写真を撮る"}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />
    </label>
  );
}
