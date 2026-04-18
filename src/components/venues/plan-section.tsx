"use client";

import { useState } from "react";
import { ChevronDown, Check, X, ShirtIcon, PartyPopper, Pencil, FileText } from "lucide-react";
import { formatYen } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PlanEditorSheet } from "@/components/venues/plan-editor-sheet";

// Luxury easing: smooth deceleration (Aesop/Apple-inspired)
const LUXURY_EASE = [0.16, 1, 0.3, 1] as const;
const COLLAPSE_TRANSITION = { duration: 0.7, ease: LUXURY_EASE };
const CHEVRON_TRANSITION = { duration: 0.6, ease: LUXURY_EASE };

interface VenuePlan {
  id: string;
  name: string;
  basePrice: number | null;
  guestCountMin: number | null;
  guestCountMax: number | null;
  includedItems: string[];
  excludedItems: string[];
  bringInItems: Array<{ item: string; fee?: number }>;
  dressAllowance: string | null;
  dressAllowanceNote: string | null;
  dressBrideCount: number | null;
  dressGroomCount: number | null;
  dressBudgetCapYen: number | null;
  campaigns: Array<{ name: string; discount?: string }>;
  notes: string | null;
}

interface PlanSectionProps {
  venueId: string;
  plans: VenuePlan[];
}

/**
 * Format the structured dress fields for read-only display.
 * Falls back through: structured > free-text note > legacy `dressAllowance` > null.
 */
function formatDressSummary(plan: VenuePlan): {
  primary: string | null;
  note: string | null;
} {
  const parts: string[] = [];
  if (plan.dressBrideCount != null) parts.push(`新婦${plan.dressBrideCount}着`);
  if (plan.dressGroomCount != null) parts.push(`新郎${plan.dressGroomCount}着`);
  let primary: string | null = parts.length > 0 ? parts.join(" + ") : null;
  if (plan.dressBudgetCapYen != null) {
    const man = Math.round(plan.dressBudgetCapYen / 10000);
    const cap = `¥${man}万まで`;
    primary = primary ? `${primary} / ${cap}` : cap;
  }
  const note =
    plan.dressAllowanceNote ?? (primary ? null : plan.dressAllowance);
  return { primary, note };
}

export function PlanSection({ venueId, plans }: PlanSectionProps) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(
    plans.length === 1 ? plans[0].id : null
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base">プランの詳細</h2>
        <PlanEditorSheet venueId={venueId} />
      </div>
      <p className="text-[12px] text-muted-foreground mb-3">
        式場のプランを記録して、見積もりと比較できます
      </p>
      {plans.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ boxShadow: "0 0 0 0.5px var(--gold-subtle)" }}>
            <FileText className="h-6 w-6 text-[var(--gold-warm)]" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-light">プランはまだありません</p>
            <p className="text-xs text-muted-foreground">
              見学時にもらったプランを記録すると、費用の比較に役立ちます
            </p>
          </div>
          <PlanEditorSheet
            venueId={venueId}
            trigger={
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 active:scale-[0.98]"
              >
                プランを記録する
              </button>
            }
          />
        </div>
      )}
      {plans.map((plan) => {
        const isExpanded = expandedPlan === plan.id;
        return (
          <div key={plan.id} className="rounded-xl bg-card shadow-[var(--shadow-card)] overflow-hidden">
            {/* Plan header */}
            <div className="relative">
              <button
              type="button"
              onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
              className="flex w-full min-h-[56px] items-center justify-between gap-3 px-4 py-3 pr-14 text-left transition-colors duration-200 active:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-[family-name:var(--font-display)] text-base font-normal truncate">{plan.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {plan.basePrice != null && (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatYen(plan.basePrice)}
                    </span>
                  )}
                  {(plan.guestCountMin != null || plan.guestCountMax != null) && (
                    <span className="text-xs text-muted-foreground">
                      ({plan.guestCountMin ?? "?"}〜{plan.guestCountMax ?? "?"}名)
                    </span>
                  )}
                </div>
              </div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={CHEVRON_TRANSITION}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </button>
              {/* Edit affordance — overlaid so the whole row stays a single
                  large tap target for expand/collapse, but the pencil sits
                  apart from it for editing. 44px tap. */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <PlanEditorSheet
                  venueId={venueId}
                  initialPlan={{
                    id: plan.id,
                    name: plan.name,
                    basePrice: plan.basePrice,
                    guestCountMin: plan.guestCountMin,
                    guestCountMax: plan.guestCountMax,
                    includedItems: plan.includedItems,
                    excludedItems: plan.excludedItems,
                    bringInItems: plan.bringInItems,
                    dressBrideCount: plan.dressBrideCount,
                    dressGroomCount: plan.dressGroomCount,
                    dressBudgetCapYen: plan.dressBudgetCapYen,
                    dressAllowanceNote: plan.dressAllowanceNote,
                    campaigns: plan.campaigns,
                    notes: plan.notes,
                  }}
                  trigger={
                    <button
                      type="button"
                      aria-label={`${plan.name} を編集`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  }
                />
              </div>
            </div>

            {/* Plan details */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={COLLAPSE_TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 border-t border-border px-4 py-4">
                    {/* Included items */}
                    {plan.includedItems.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]">
                          <Check className="h-4 w-4" />
                          プランに含まれるもの
                        </p>
                        <ul className="space-y-1">
                          {plan.includedItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Excluded items */}
                    {plan.excludedItems.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
                          <X className="h-4 w-4" />
                          別途必要なもの
                        </p>
                        <ul className="space-y-1">
                          {plan.excludedItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Bring-in items — 3-column table: 品目 / 可否 / 料金 */}
                    {plan.bringInItems.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-tone-gold">
                          お持ち込みできるもの
                        </p>
                        {/* Header row */}
                        <div className="grid grid-cols-[1fr_48px_88px] border-b border-border pb-1 text-xs text-muted-foreground">
                          <span>品目</span>
                          <span className="text-center">可否</span>
                          <span className="text-right">持込料</span>
                        </div>
                        {plan.bringInItems.map((bi, i) => {
                          const allowed = (bi as { item: string; fee?: number; allowed?: boolean }).allowed !== false;
                          const fee = bi.fee;
                          return (
                            <div
                              key={i}
                              className="grid grid-cols-[1fr_48px_88px] border-t border-border py-2 text-sm"
                            >
                              <span>{bi.item}</span>
                              <span className="text-center">
                                {allowed ? (
                                  <Check className="mx-auto h-4 w-4 text-[color-mix(in_oklab,var(--success,#22c55e)_80%,var(--foreground))]" />
                                ) : (
                                  <X className="mx-auto h-4 w-4 text-destructive/70" />
                                )}
                              </span>
                              <span className="tabular-nums text-right text-xs text-muted-foreground">
                                {fee != null ? formatYen(fee) : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Dress (structured > note > legacy free-text) */}
                    {(() => {
                      const { primary, note } = formatDressSummary(plan);
                      if (!primary && !note) return null;
                      return (
                        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                          <ShirtIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">衣裳のご予算目安</p>
                            {primary && (
                              <p className="text-sm tabular-nums">{primary}</p>
                            )}
                            {note && (
                              <p className="text-sm text-muted-foreground">{note}</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Campaigns */}
                    {plan.campaigns.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <PartyPopper className="h-4 w-4" />
                          うれしい特典
                        </p>
                        <ul className="space-y-1.5">
                          {plan.campaigns.map((camp, i) => (
                            <li key={i} className="rounded-lg bg-primary/5 px-3 py-2 text-sm">
                              <span className="font-medium">{camp.name}</span>
                              {camp.discount && (
                                <span className="ml-2 text-xs text-primary">{camp.discount}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Notes */}
                    {plan.notes && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{plan.notes}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </section>
  );
}
