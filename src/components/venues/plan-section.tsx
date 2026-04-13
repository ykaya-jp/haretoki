"use client";

import { useState } from "react";
import { ChevronDown, Check, X, DollarSign, ShirtIcon, PartyPopper } from "lucide-react";
import { formatYen } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
  campaigns: Array<{ name: string; discount?: string }>;
  notes: string | null;
}

interface PlanSectionProps {
  plans: VenuePlan[];
}

export function PlanSection({ plans }: PlanSectionProps) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(
    plans.length === 1 ? plans[0].id : null
  );

  if (plans.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-base">プラン情報</h2>
      {plans.map((plan) => {
        const isExpanded = expandedPlan === plan.id;
        return (
          <div key={plan.id} className="rounded-xl bg-card shadow-[var(--shadow-card)] overflow-hidden">
            {/* Plan header */}
            <button
              type="button"
              onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
              className="flex w-full min-h-[56px] items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-400 active:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <p className="font-serif text-base font-normal truncate">{plan.name}</p>
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
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-green-600">
                          <Check className="h-3.5 w-3.5" />
                          含まれるもの
                        </p>
                        <ul className="space-y-1">
                          {plan.includedItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Excluded items */}
                    {plan.excludedItems.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-500">
                          <X className="h-3.5 w-3.5" />
                          含まれないもの
                        </p>
                        <ul className="space-y-1">
                          {plan.excludedItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Bring-in items */}
                    {plan.bringInItems.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                          <DollarSign className="h-3.5 w-3.5" />
                          持ち込み可能なもの
                        </p>
                        <ul className="space-y-1">
                          {plan.bringInItems.map((bi, i) => (
                            <li key={i} className="flex items-center justify-between text-sm">
                              <span>{bi.item}</span>
                              {bi.fee != null && (
                                <span className="tabular-nums text-xs text-muted-foreground">
                                  持込料 {formatYen(bi.fee)}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Dress allowance */}
                    {plan.dressAllowance && (
                      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
                        <ShirtIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">衣裳限度額</p>
                          <p className="text-sm">{plan.dressAllowance}</p>
                        </div>
                      </div>
                    )}

                    {/* Campaigns */}
                    {plan.campaigns.length > 0 && (
                      <div>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <PartyPopper className="h-3.5 w-3.5" />
                          キャンペーン・特典
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
