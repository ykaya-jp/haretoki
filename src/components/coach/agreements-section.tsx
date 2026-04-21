"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle, Check, RotateCw } from "lucide-react";
import {
  createAgreement,
  deleteAgreement,
  updateAgreementStatus,
} from "@/server/actions/agreements";
import type { AgreementStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

type AgreementItem = { id: string; text: string; status: AgreementStatus };

const STATUS_ORDER: AgreementStatus[] = ["discussing", "decided", "revisit"];

function nextStatus(current: AgreementStatus): AgreementStatus {
  const idx = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

const STATUS_LABEL: Record<AgreementStatus, string> = {
  discussing: "話してる",
  decided: "決めた",
  revisit: "再検討",
};

const STATUS_ICON: Record<
  AgreementStatus,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  discussing: MessageCircle,
  decided: Check,
  revisit: RotateCw,
};

function chipClass(status: AgreementStatus): string {
  if (status === "decided") {
    return "bg-[var(--gold-subtle)] border-[color-mix(in_oklab,var(--gold-warm)_40%,transparent)] text-foreground";
  }
  if (status === "revisit") {
    return "border-[color-mix(in_oklab,var(--primary)_35%,transparent)] text-[color:var(--primary)]";
  }
  return "border-border text-muted-foreground";
}

interface Props {
  initialAgreements: AgreementItem[];
}

export function AgreementsSection({ initialAgreements }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimisticAgreements, dispatchOptimistic] = useOptimistic(
    initialAgreements,
    (
      state,
      action:
        | { type: "add"; item: AgreementItem }
        | { type: "update"; id: string; status: AgreementStatus }
        | { type: "remove"; id: string },
    ) => {
      if (action.type === "add") return [action.item, ...state];
      if (action.type === "update") {
        return state.map((a) =>
          a.id === action.id ? { ...a, status: action.status } : a,
        );
      }
      if (action.type === "remove")
        return state.filter((a) => a.id !== action.id);
      return state;
    },
  );

  const [inputOpen, setInputOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleToggleStatus(item: AgreementItem) {
    const newStatus = nextStatus(item.status);
    startTransition(async () => {
      dispatchOptimistic({ type: "update", id: item.id, status: newStatus });
      const result = await updateAgreementStatus(item.id, newStatus);
      if ("error" in result && result.error) {
        toast.error("更新できませんでした");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      dispatchOptimistic({ type: "remove", id });
      const result = await deleteAgreement(id);
      if ("error" in result && result.error) {
        toast.error("削除できませんでした");
      }
    });
  }

  function handleOpenInput() {
    setInputOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticItem: AgreementItem = {
      id: tempId,
      text,
      status: "discussing",
    };

    setInputText("");
    setInputOpen(false);

    startTransition(async () => {
      dispatchOptimistic({ type: "add", item: optimisticItem });
      const result = await createAgreement(text, "discussing");
      if ("error" in result && result.error) {
        toast.error("追加できませんでした");
        dispatchOptimistic({ type: "remove", id: tempId });
      }
    });
  }

  return (
    <section aria-label="ふたりの話し合い" className="space-y-3">
      <div className="flex items-baseline gap-2">
        <p className="text-eyebrow text-muted-foreground">
          Dialogue
        </p>
        {/* Coach intra-card h2 — Noto Serif JP at 15px (< 24px → --font-display) */}
        <h2 className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
          ふたりの話し合い
        </h2>
      </div>

      {optimisticAgreements.length === 0 && !inputOpen ? (
        <p className="text-[12.5px] text-muted-foreground">
          話したことを、ひとつずつ残しておきましょう。「決めたこと」も「もう一度考えたいこと」も。
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {optimisticAgreements.map((item) => (
            <div key={item.id} className="group flex items-center gap-1">
              <button
                onClick={() => handleToggleStatus(item)}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-all active:scale-[0.97]",
                  chipClass(item.status),
                )}
                aria-label={`${item.text} — ${STATUS_LABEL[item.status]}（タップで変更）`}
                disabled={isPending}
              >
                {(() => {
                  const Icon = STATUS_ICON[item.status];
                  return (
                    <Icon
                      className="h-3 w-3 shrink-0"
                      strokeWidth={1.8}
                    />
                  );
                })()}
                <span className="text-eyebrow opacity-80">
                  {STATUS_LABEL[item.status]}
                </span>
                <span aria-hidden="true" className="opacity-30">·</span>
                <span>{item.text}</span>
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[11px] text-muted-foreground opacity-0 transition-opacity group-focus-within:flex group-hover:flex group-hover:opacity-100 active:scale-[0.97]"
                aria-label={`${item.text}を削除`}
                disabled={isPending}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {inputOpen ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="話し合いの内容を入力…"
            maxLength={200}
            className="min-h-[44px] flex-1 rounded-full border border-border bg-background px-3 text-[12.5px] outline-none focus:border-[color:var(--primary)] focus:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setInputOpen(false);
                setInputText("");
              }
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isPending}
            className="min-h-[44px] rounded-full bg-[color:var(--primary)] px-4 text-[12.5px] text-primary-foreground disabled:opacity-40 active:scale-[0.97]"
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => {
              setInputOpen(false);
              setInputText("");
            }}
            className="min-h-[44px] min-w-[44px] rounded-full text-[12.5px] text-muted-foreground active:scale-[0.97]"
          >
            ×
          </button>
        </form>
      ) : (
        <button
          onClick={handleOpenInput}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-dashed border-border px-3 text-[12.5px] text-muted-foreground transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] active:scale-[0.97]"
        >
          ＋ 話し合いを追加
        </button>
      )}
    </section>
  );
}
