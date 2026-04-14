"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonProps {
  venueName: string;
  /** Optional override for the URL to share. Defaults to window.location.href. */
  url?: string;
}

/**
 * Share button — uses Web Share API when available,
 * falls back to clipboard copy.
 */
export function ShareButton({ venueName, url }: ShareButtonProps) {
  const handleShare = async () => {
    const shareUrl =
      url ?? (typeof window !== "undefined" ? window.location.href : "");
    const shareData = {
      title: venueName,
      text: `Haretokiで見つけた式場: ${venueName}`,
      url: shareUrl,
    };

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share(shareData);
        toast.success("共有しました");
        return;
      }
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("URLをコピーしました");
        return;
      }
      toast.error("共有に対応していません");
    } catch (err) {
      // User dismissing the share sheet raises AbortError — ignore silently.
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("共有に失敗しました");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="この式場を共有"
      title="共有"
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all duration-150 active:scale-95 hover:bg-muted hover:text-foreground"
    >
      <Share2 className="h-5 w-5" />
    </button>
  );
}
