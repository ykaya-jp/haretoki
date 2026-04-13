"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface PartnerInviteProps {
  inviteLink: string;
  partnerStatus: "not_invited" | "invited" | "viewed" | "reacted" | "joined";
}

export function PartnerInvite({ inviteLink, partnerStatus }: PartnerInviteProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("招待リンクをコピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLineShare = () => {
    window.open(
      `https://line.me/R/share?text=${encodeURIComponent(`一緒に式場を選びませんか？\n${inviteLink}`)}`,
      "_blank"
    );
  };

  if (partnerStatus === "joined") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">パートナーと一緒に式場さがし中です</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      {partnerStatus === "not_invited" ? (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground">
              <span className="text-muted-foreground">+</span>
            </div>
            <div>
              <p className="text-sm font-medium">パートナーを招待</p>
              <p className="text-xs text-muted-foreground">おふたりで式場を選べます</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLineShare}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              LINEで招待
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm active:scale-95"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "コピー済" : "コピー"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-center space-y-1">
            <p className="text-sm">
              {partnerStatus === "invited" && "招待を送りました"}
              {partnerStatus === "viewed" && "パートナーがリンクを見てくれました"}
              {partnerStatus === "reacted" && "パートナーが反応してくれました"}
            </p>
            <p className="text-xs text-muted-foreground">
              届いていないときは、もう一度送れます
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLineShare}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white transition-all duration-[400ms] active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              もう一度LINEで送る
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition-all duration-[400ms] active:scale-95"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "コピー済" : "リンクをコピー"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
