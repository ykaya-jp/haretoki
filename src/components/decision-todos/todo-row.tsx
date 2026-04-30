"use client";

import { useState, useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { showToast } from "@/lib/toast";
import {
  toggleTodo,
  deleteCustomTodo,
  type DecisionTodoView,
} from "@/server/actions/decision-todos";

interface TodoRowProps {
  todo: DecisionTodoView;
  /** 初回の toast を制御するため、親が「これが最初の完了かどうか」を渡す */
  isFirstCompletion?: boolean;
  /** aria-live 用のアナウンサー。「1 件完了。残り N 件」など */
  onToggled?: (args: {
    completed: boolean;
    allCompleted: boolean;
  }) => void;
}

/**
 * 単一 todo 行。44x44 hit area を確保するため、行高は min-h-[56px] に。
 * checkbox は視覚 24px + padding で 44px 確保。
 */
export function TodoRow({ todo, onToggled }: TodoRowProps) {
  // Optimistic: toggle UI 即時反応。サーバー往復はバックグラウンド。
  const [optimisticCompleted, setOptimisticCompleted] = useState(
    todo.completedAt !== null,
  );
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  const priorityLabel =
    todo.priority === "high"
      ? "たいせつ"
      : todo.priority === "low"
        ? "あとで"
        : null;

  const dueLabel =
    todo.dueOffsetDays !== null
      ? `あと ${todo.dueOffsetDays} 日めやす`
      : null;

  const handleToggle = () => {
    const next = !optimisticCompleted;
    setOptimisticCompleted(next); // 即時反映
    startTransition(async () => {
      const res = await toggleTodo(todo.id);
      if ("error" in res) {
        // Roll back optimistic state on error.
        setOptimisticCompleted(!next);
        showToast("error", "うまくいきませんでした");
        return;
      }
      onToggled?.({
        completed: res.completed,
        allCompleted: res.allCompleted,
      });
    });
  };

  const handleDelete = () => {
    setDeleting(true);
    startTransition(async () => {
      const res = await deleteCustomTodo(todo.id);
      if ("error" in res) {
        setDeleting(false);
        showToast("error", "消せませんでした");
        return;
      }
      showToast("info", "消しました");
      // Parent refreshes via server action revalidate — no local removal needed.
    });
  };

  return (
    <li
      className={`flex items-start gap-3 rounded-2xl border border-border bg-card p-3 transition-opacity ${
        deleting ? "opacity-40" : ""
      }`}
    >
      {/* 44x44 hit area — visual checkbox is 24x24 centered via padding */}
      <button
        type="button"
        role="checkbox"
        aria-checked={optimisticCompleted}
        aria-describedby={todo.description ? `todo-desc-${todo.id}` : undefined}
        onClick={handleToggle}
        className="relative -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-[0.92] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-warm)]/40"
      >
        <span
          aria-hidden
          className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-colors ${
            optimisticCompleted
              ? "border-[var(--gold-warm)] bg-[var(--gold-warm)] text-white"
              : "border-[var(--border)] bg-transparent"
          }`}
        >
          {optimisticCompleted && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </span>
      </button>

      <div className="min-w-0 flex-1 py-1">
        <p
          className={`text-[14px] leading-[1.45] transition-colors ${
            optimisticCompleted
              ? "text-muted-foreground/60 line-through decoration-[0.5px]"
              : "text-foreground"
          }`}
        >
          {todo.title}
        </p>
        {todo.description && (
          <p
            id={`todo-desc-${todo.id}`}
            className={`mt-1 text-[12.5px] leading-[1.55] ${
              optimisticCompleted
                ? "text-muted-foreground/40 line-through"
                : "text-muted-foreground"
            }`}
          >
            {todo.description}
          </p>
        )}
        {(dueLabel || priorityLabel) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
            {dueLabel && <span>{dueLabel}</span>}
            {dueLabel && priorityLabel && (
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
            )}
            {priorityLabel && (
              <span
                className={
                  todo.priority === "high"
                    ? "text-[var(--gold-warm)]"
                    : undefined
                }
              >
                {priorityLabel}
              </span>
            )}
          </p>
        )}
      </div>

      {todo.source === "custom" && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label="このやることを消す"
          className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:bg-muted"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      )}
    </li>
  );
}
