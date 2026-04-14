"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/server/actions/profile";

interface NameEditProps {
  currentName: string | null;
}

export function NameEdit({ currentName }: NameEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentName ?? "");
  // Track the last prop we synced from, so we can re-hydrate `value`
  // when the parent re-renders with a new name (e.g. after router.refresh()
  // following a successful update). Setting state during render is the
  // idiomatic way to sync derived state with a changing prop in React.
  const [lastSyncedName, setLastSyncedName] = useState(currentName);
  if (currentName !== lastSyncedName) {
    setLastSyncedName(currentName);
    setValue(currentName ?? "");
  }
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const cancel = () => {
    setValue(currentName ?? "");
    setIsEditing(false);
  };

  const save = () => {
    if (isPending) return;
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("名前を入力してください");
      return;
    }
    startTransition(async () => {
      const result = await updateDisplayName(trimmed);
      if (result.success) {
        toast.success("お名前を更新しました");
        setIsEditing(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="group flex w-full items-center justify-between gap-3 rounded-lg text-left transition-colors active:scale-[0.99]"
        aria-label="お名前を編集する"
      >
        <span className="font-medium">
          {currentName && currentName.length > 0 ? currentName : "(未設定)"}
        </span>
        <Pencil className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        maxLength={50}
        disabled={isPending}
        placeholder="お名前を入力"
        aria-label="お名前"
        className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        aria-label="保存"
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all active:scale-[0.95] disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={isPending}
        aria-label="キャンセル"
        className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-all active:scale-[0.95] disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
