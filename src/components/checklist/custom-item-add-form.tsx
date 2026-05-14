"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCustomChecklistItem } from "@/server/actions/checklist-ratings";

/**
 * v3 plan H4 — couples can add their own checklist question on top of
 * the static CHECKLIST_PRESETS library. Writes to the
 * `custom_checklist_items` table (added in PR #2) via the same-named
 * server action; the server action enforces the 50-item cap and the
 * project membership check.
 *
 * UI intent (= minimum viable, additive):
 *  - Sits at the bottom of /checklist as an opt-in "+" form, so the
 *    existing preset selection flow is unchanged for couples who don't
 *    want custom questions.
 *  - Single-line input + category select inside one open form; we
 *    deliberately don't gate it behind a modal because the friction is
 *    higher than the value at this PR's scope (= adding 1 question
 *    once a week).
 *  - On success, refreshes the route so the page rebuilds with the
 *    new item visible (= the page-level data fetch is canonical, no
 *    optimistic state to sync).
 *
 * What this PR does NOT add:
 *  - In-board display of custom items in the existing grouped sections
 *    (= they live in DB now, will surface in the comparison drawer +
 *    custom-aware listing in a follow-up PR).
 *  - Delete UI for custom items (deleteCustomChecklistItem exists
 *    server-side; UI affordance for it is the next PR).
 */
const CATEGORY_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "chapel", label: "挙式会場" },
  { value: "banquet", label: "披露宴会場" },
  { value: "cuisine_drink", label: "料理・飲み物" },
  { value: "dress_item", label: "衣裳・アイテム" },
  { value: "staff_estimate", label: "スタッフ・見積り" },
  { value: "facility", label: "設備" },
];

export function CustomItemAddForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0].value);
  const [question, setQuestion] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < 2) {
      toast.error("問いを 2 文字以上で書いてください");
      return;
    }
    startTransition(async () => {
      const result = await addCustomChecklistItem({
        category,
        subcategory: null,
        question: trimmed,
      });
      if (!result.success) {
        const detail =
          typeof result.error === "object" &&
          result.error &&
          "formErrors" in result.error
            ? (result.error.formErrors?.[0] ?? null)
            : null;
        toast.error(
          detail
            ? `追加できませんでした: ${detail}`
            : "追加できませんでした。少し時間をおいて お試しください",
        );
        return;
      }
      toast.success("質問を 追加しました");
      setQuestion("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="px-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gold-warm)]/50 bg-card/40 px-4 text-sm italic text-[var(--gold-warm)] transition-all active:scale-[0.99] active:bg-[var(--gold-warm)]/10"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          自分で 評価項目を 足す
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-[var(--gold-warm)]/40 bg-[color-mix(in_oklab,var(--gold-warm)_4%,transparent)] p-4"
    >
      <div className="text-[10.5px] uppercase tracking-[0.28em] text-[var(--gold-warm)]">
        評価項目を足す
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="custom-item-category"
          className="block text-xs text-muted-foreground"
        >
          カテゴリ
        </label>
        <select
          id="custom-item-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isPending}
          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-[family-name:var(--font-display)] italic outline-none focus:border-[var(--gold-warm)]"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="custom-item-question"
          className="block text-xs text-muted-foreground"
        >
          問い
        </label>
        <Input
          id="custom-item-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例: 親族控室の畳数 は 十分？"
          maxLength={140}
          disabled={isPending}
          className="font-[family-name:var(--font-display)] italic"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (isPending) return;
            setQuestion("");
            setOpen(false);
          }}
          className="h-11 px-3 text-xs italic text-muted-foreground"
        >
          やめる
        </button>
        <Button type="submit" disabled={isPending || question.trim().length < 2}>
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          追加する
        </Button>
      </div>
      <p className="text-[10.5px] italic text-muted-foreground/80">
        追加した問いは ふたりの 比較表 で 評価できます。 50 件まで。
      </p>
    </form>
  );
}
