"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { showToast } from "@/lib/toast";
import { addCustomTodo } from "@/server/actions/decision-todos";

interface Props {
  disabled?: boolean;
  remaining: number;
}

/**
 * カスタム todo 追加フォーム。折りたたみ式で、未使用時は
 * 「＋ 自分たちの やること を追加」の破線 CTA のみ表示する（Drop Zone パターン）。
 */
export function AddCustomTodoForm({ disabled, remaining }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      showToast("error", "やることを入力してください");
      return;
    }
    startTransition(async () => {
      const res = await addCustomTodo({ title: trimmed });
      if ("error" in res) {
        const firstMsg =
          res.error.title?.[0] ??
          res.error.description?.[0] ??
          "追加できませんでした";
        showToast("error", firstMsg);
        return;
      }
      showToast("success", "メモに加えました");
      setTitle("");
      setExpanded(false);
    });
  };

  if (disabled) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-center text-[12px] text-muted-foreground">
        自分たちのやることは上限 10 件です
      </p>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-[13px] text-muted-foreground transition-colors hover:border-[var(--gold-warm)] hover:text-foreground active:bg-muted"
      >
        <Plus className="h-4 w-4" strokeWidth={1.5} />
        自分たちの やること を追加
        <span className="ml-1 tabular-nums text-[11px] text-muted-foreground/70">
          あと {remaining} 件
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-[var(--gold-warm)]/60 bg-card p-3">
      <label htmlFor="custom-todo-title" className="sr-only">
        やること
      </label>
      <input
        id="custom-todo-title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="例: 親への挨拶を決める"
        autoFocus
        disabled={pending}
        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none focus:border-[var(--gold-warm)]/50 focus:ring-1 focus:ring-[var(--gold-warm)]/30"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending}
          className="h-11 flex-1 rounded-full text-[13px] font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "var(--gold-warm)",
          }}
        >
          {pending ? "加えています…" : "加える"}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setTitle("");
          }}
          disabled={pending}
          className="h-11 rounded-full border border-border px-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground active:bg-muted disabled:opacity-60"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
