"use client";

import { useState, useTransition, useCallback } from "react";
import { updateChecklistItemStatus } from "@/server/actions/visits";
import { Check, X, ChevronDown, MessageSquare, Camera, Loader2, Sparkles, Plus } from "lucide-react";
import Image from "next/image";
import { addChecklistPhoto } from "@/server/actions/visits";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CHECKLIST_TEMPLATES } from "@/lib/checklist-templates";
import { generateAIChecklistForVenue } from "@/server/actions/ai-visit-checklist";
import type { AIChecklistItem } from "@/server/actions/ai-visit-checklist";

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
  venueId?: string;
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

export function VisitChecklist({ items, venueId }: VisitChecklistProps) {
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

  // AI checklist state
  const [aiItems, setAiItems] = useState<AIChecklistItem[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerateAI = useCallback(async () => {
    if (!venueId) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await generateAIChecklistForVenue(venueId);
      if ("error" in result) {
        setAiError(result.error);
      } else {
        setAiItems(result.items);
      }
    } catch {
      setAiError("AI提案の取得中にエラーが発生しました");
    } finally {
      setAiLoading(false);
    }
  }, [venueId]);

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

      {/* AI-generated venue-specific checklist section */}
      {venueId && (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--gold,#b8972a)_30%,var(--border))] overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[color-mix(in_oklab,var(--gold,#b8972a)_6%,var(--background))] border-l-[3px] border-l-[var(--gold,#b8972a)]">
            <Sparkles className="h-4 w-4 text-[var(--gold,#b8972a)] shrink-0" />
            <p className="text-sm font-medium text-foreground">この式場で確認すべきこと (AI 提案)</p>
          </div>

          <div className="px-4 py-3">
            {/* Initial state: show generate button */}
            {!aiItems && !aiLoading && !aiError && (
              <button
                type="button"
                onClick={handleGenerateAI}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color-mix(in_oklab,var(--gold,#b8972a)_12%,var(--background))] border border-[color-mix(in_oklab,var(--gold,#b8972a)_40%,var(--border))] px-4 py-2 text-sm text-[color-mix(in_oklab,var(--gold,#b8972a)_80%,var(--foreground))] transition-colors duration-200 active:scale-[0.98] active:bg-[color-mix(in_oklab,var(--gold,#b8972a)_20%,var(--background))]"
              >
                <Sparkles className="h-4 w-4" />
                AIに提案してもらう
              </button>
            )}

            {/* Loading state */}
            {aiLoading && (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>式場の特徴を分析しています…</span>
              </div>
            )}

            {/* Error state */}
            {aiError && !aiLoading && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{aiError}</p>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  className="text-xs text-[color-mix(in_oklab,var(--gold,#b8972a)_80%,var(--foreground))] underline underline-offset-2"
                >
                  もう一度試す
                </button>
              </div>
            )}

            {/* Results */}
            {aiItems && (
              <div className="space-y-3">
                {aiItems.map((ai, idx) => (
                  <AIChecklistRow
                    key={idx}
                    item={ai}
                  />
                ))}
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  className="mt-1 text-xs text-muted-foreground underline underline-offset-2 active:text-foreground"
                >
                  再生成する
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                    ? "bg-[color-mix(in_oklab,var(--success,#22c55e)_12%,var(--background))] text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]"
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
                                item.status === "yes" ? "border-[var(--success,#22c55e)] bg-[var(--success,#22c55e)] text-primary-foreground" :
                                item.status === "no" ? "border-[color-mix(in_oklab,var(--destructive)_45%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_10%,var(--background))] text-[color:var(--destructive)]" :
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
                                          <Image src={url} alt="" fill sizes="64px" className="object-cover" />
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

function AIChecklistRow({ item }: { item: AIChecklistItem }) {
  const [added, setAdded] = useState(false);

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors duration-200",
      added && "opacity-50"
    )}>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{item.item}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
      </div>
      <button
        type="button"
        disabled={added}
        onClick={() => setAdded(true)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--gold,#b8972a)_40%,var(--border))] text-[color-mix(in_oklab,var(--gold,#b8972a)_80%,var(--foreground))] transition-colors duration-200 active:bg-[color-mix(in_oklab,var(--gold,#b8972a)_12%,var(--background))] disabled:opacity-40"
        aria-label="確認リストに追加"
      >
        {added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </button>
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
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Camera className="h-4 w-4" />
      )}
      {uploading ? "送っています…" : "写真を撮る"}
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
