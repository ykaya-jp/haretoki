"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSavedSearch } from "@/server/actions/saved-searches";

interface SavedSearchDeleteButtonProps {
  id: string;
}

export function SavedSearchDeleteButton({ id }: SavedSearchDeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSavedSearch(id);
      if (result.ok) {
        toast.success("削除しました");
        router.refresh();
      } else {
        toast.error("削除に失敗しました");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      aria-label="削除"
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 hover:text-destructive active:scale-95 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
