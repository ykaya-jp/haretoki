"use client";

import { useTransition, useOptimistic } from "react";
import { Check } from "lucide-react";
import { toggleVisitQuestion } from "@/server/actions/visit-questions";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  item: string;
  category: string;
  status: "unchecked" | "yes" | "no";
  memo: string | null;
  sortOrder: number;
}

interface VisitQuestionsListProps {
  questions: Question[];
}

export function VisitQuestionsList({ questions: initial }: VisitQuestionsListProps) {
  const [optimistic, applyOptimistic] = useOptimistic(
    initial,
    (state: Question[], update: { id: string; status: Question["status"] }) =>
      state.map((q) =>
        q.id === update.id ? { ...q, status: update.status } : q,
      ),
  );
  const [, startTransition] = useTransition();

  const handleToggle = (q: Question) => {
    const nextStatus: Question["status"] =
      q.status === "unchecked" ? "yes" : "unchecked";
    startTransition(async () => {
      applyOptimistic({ id: q.id, status: nextStatus });
      await toggleVisitQuestion(q.id, nextStatus);
    });
  };

  // Group by stripped category
  const grouped = optimistic.reduce<Record<string, Question[]>>((acc, q) => {
    (acc[q.category] ??= []).push(q);
    return acc;
  }, {});

  const doneCount = optimistic.filter((q) => q.status !== "unchecked").length;
  const pct = Math.round((doneCount / Math.max(1, optimistic.length)) * 100);

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-4"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 6%, var(--background)) 0%, color-mix(in oklab, var(--primary) 3%, var(--background)) 100%)",
        }}
      >
        <p className="text-[11px] text-muted-foreground">
          <span className="font-[family-name:var(--font-display)] tabular-nums text-foreground">
            {doneCount}
          </span>{" "}
          / {optimistic.length} 問 確認済み · {pct}%
        </p>
        <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[var(--gold-warm)] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <section key={category} className="space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              質問カテゴリ
            </p>
            <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-[-0.005em]">
              {category}
            </h2>
          </div>
          <ul className="space-y-1.5">
            {items.map((q) => {
              const checked = q.status !== "unchecked";
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => handleToggle(q)}
                    aria-pressed={checked}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border bg-card px-3.5 py-3 text-left transition active:scale-[0.99]",
                      checked && "bg-[var(--gold-subtle)] border-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)]",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                        checked
                          ? "bg-[var(--gold-warm)] border-[var(--gold-warm)] text-white"
                          : "border-border",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={2.2} />}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[13.5px] leading-relaxed",
                        checked && "text-muted-foreground line-through decoration-1",
                      )}
                    >
                      {q.item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="pt-2 text-[11px] text-muted-foreground leading-relaxed">
        ※ ご希望に合わせて質問を追加したい場合は、
        項目タイトル下の「＋ 質問を追加」(今後実装予定) からどうぞ。
      </p>
    </div>
  );
}
