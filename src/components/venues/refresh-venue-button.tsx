"use client";

import { useTransition } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshVenueFromSource } from "@/server/actions/venues";

interface Props {
  venueId: string;
  hasSourceUrl: boolean;
}

export function RefreshVenueButton({ venueId, hasSourceUrl }: Props) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!hasSourceUrl) return null;

  const onClick = () => {
    start(async () => {
      try {
        const result = await refreshVenueFromSource(venueId);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        const { updatedFields, photoAddedCount } = result;
        if (updatedFields.length === 0 && photoAddedCount === 0) {
          toast.info("最新情報と変わりませんでした");
        } else {
          const parts: string[] = [];
          if (updatedFields.length > 0) {
            parts.push(`${updatedFields.length}項目を更新`);
          }
          if (photoAddedCount > 0) {
            parts.push(`${photoAddedCount}枚の写真を追加`);
          }
          toast.success(parts.join(" / "));
        }
        router.refresh();
      } catch {
        toast.error("最新化に失敗しました");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-foreground/30 active:scale-95 disabled:opacity-50"
      aria-label="登録元のページから最新情報を取り込む"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" />
      )}
      {pending ? "最新化中..." : "最新の情報に更新"}
    </button>
  );
}
