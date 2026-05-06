"use client";

import { useState } from "react";
import { Check, X, Minus, Image as ImageIcon, NotebookPen } from "lucide-react";
import type { ComparisonMatrix } from "@/lib/comparison-types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/checklist-presets";
import type { ChecklistCategory } from "@/lib/checklist-presets";

/**
 * Cross-venue checklist comparison — for each checklist category
 * (挙式会場 / 披露宴会場 / 料理 / 衣裳 / スタッフ / 費用 / 設備),
 * shows EVERY active item as a row with one cell per venue.
 *
 * The mobile snapper shows checklist items one venue at a time
 * (swipe to next), which means couples can't actually compare two
 * venues' answers side-by-side without scrolling back and forth.
 * This card is the proper horizontal table — items down, venues
 * across — collapsible per category.
 *
 * Self-hides if no checklist items are active across the comparison.
 */
export function ChecklistCrossVenueCard({
  matrix,
}: {
  matrix: ComparisonMatrix;
}) {
  if (matrix.items.length === 0 || matrix.venues.length === 0) return null;

  // Group items by checklist category, preserving CATEGORY_ORDER.
  const groups = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: matrix.items.filter((it) => it.category === cat),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return (
    <section
      aria-label="チェック項目の横並び"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <NotebookPen
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p className="text-eyebrow text-[var(--gold-warm)]">
          チェック項目の横並び
        </p>
      </div>
      <p className="mt-2 text-fluid-xs leading-relaxed text-muted-foreground">
        挙式会場・披露宴会場 など細かい一つひとつの項目を、選んだ式場ぜんぶで横並びに見ます。
      </p>

      <div className="mt-3 space-y-2">
        {groups.map((g) => (
          <CategoryGroup
            key={g.category}
            category={g.category}
            label={g.label}
            items={g.items}
            venues={matrix.venues}
            answers={matrix.answers}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryGroup({
  category,
  label,
  items,
  venues,
  answers,
}: {
  category: ChecklistCategory;
  label: string;
  items: ComparisonMatrix["items"];
  venues: ComparisonMatrix["venues"];
  answers: ComparisonMatrix["answers"];
}) {
  // Default: 挙式会場 + 披露宴会場 を開く (most-used)、他は折りたたみ
  const defaultOpen = category === "chapel" || category === "banquet";
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border/60 bg-background">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted/60"
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-display)] text-fluid-base font-light text-foreground">
            {label}
          </span>
          <span className="tabular-nums text-fluid-xs text-muted-foreground">
            {items.length} 項目
          </span>
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          {open ? "−" : "＋"}
        </span>
      </button>

      {open && (
        <div className="-mt-1 overflow-x-auto px-4 pb-3">
          <table className="w-full min-w-[480px] border-separate border-spacing-y-1.5">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-[40%] bg-background pr-2 text-left text-fluid-xs font-medium text-muted-foreground"
                >
                  項目
                </th>
                {venues.map((v) => (
                  <th
                    key={v.id}
                    scope="col"
                    className="px-2 text-center align-bottom text-fluid-xs font-medium text-foreground"
                  >
                    <span className="line-clamp-2 font-[family-name:var(--font-display)] font-light leading-tight">
                      {v.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-background pr-2 align-top text-left text-fluid-xs font-normal leading-snug text-foreground"
                  >
                    {item.subcategory && (
                      <span className="mr-1 text-muted-foreground">
                        {item.subcategory}・
                      </span>
                    )}
                    {item.question}
                  </th>
                  {venues.map((v) => {
                    const ans = answers[item.id]?.[v.id];
                    return (
                      <td
                        key={v.id}
                        className="px-2 text-center align-top text-fluid-xs"
                      >
                        <AnswerCell answer={ans} type={item.type} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AnswerCell({
  answer,
  type,
}: {
  answer: { status: string | null; memo: string | null; numberValue: number | null; photoUrls: string[] } | undefined;
  type: string;
}) {
  if (!answer) {
    return <span className="text-muted-foreground/40">—</span>;
  }

  // yesno: status = "yes" | "no" | "unchecked" | null
  if (type === "yesno") {
    if (answer.status === "yes") {
      return (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
          aria-label="はい"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      );
    }
    if (answer.status === "no") {
      return (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="いいえ"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      );
    }
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/40"
        aria-label="未確認"
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }

  // number: numberValue
  if (type === "number" && answer.numberValue != null) {
    return (
      <span className="tabular-nums font-medium text-foreground">
        {answer.numberValue.toLocaleString("ja-JP")}
      </span>
    );
  }

  // memo: memo (truncate to 30 chars)
  if (type === "memo" || type === "photo") {
    const hasMemo = answer.memo && answer.memo.trim().length > 0;
    const hasPhoto = answer.photoUrls.length > 0;
    if (!hasMemo && !hasPhoto) {
      return <span className="text-muted-foreground/40">—</span>;
    }
    return (
      <span className="inline-flex max-w-[140px] items-baseline gap-1 text-left">
        {hasMemo && (
          <span className="line-clamp-2 text-foreground/85">
            {answer.memo!.length > 30
              ? `${answer.memo!.slice(0, 30)}…`
              : answer.memo}
          </span>
        )}
        {hasPhoto && !hasMemo && (
          <ImageIcon
            className="h-3.5 w-3.5 text-[var(--gold-warm)]"
            strokeWidth={1.6}
            aria-label={`${answer.photoUrls.length} 枚の写真`}
          />
        )}
        {hasPhoto && hasMemo && (
          <ImageIcon
            className="h-3 w-3 shrink-0 text-[var(--gold-warm)]"
            strokeWidth={1.6}
            aria-label={`${answer.photoUrls.length} 枚の写真`}
          />
        )}
      </span>
    );
  }

  return <span className="text-muted-foreground/40">—</span>;
}
