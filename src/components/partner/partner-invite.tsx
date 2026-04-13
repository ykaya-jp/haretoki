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
    toast.success("リンクをコピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLineShare = () => {
    window.open(
      `https://line.me/R/share?text=${encodeURIComponent(`式場選び一緒にやりませんか？\n${inviteLink}`)}`,
      "_blank"
    );
  };

  if (partnerStatus === "joined") {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-sm text-muted-foreground">パートナーが参加しています</p>
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
              <p className="text-xs text-muted-foreground">一緒に式場選びをしましょう</p>
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
        <div className="text-center">
          <p className="text-sm">
            {partnerStatus === "invited" && "招待を送信しました"}
            {partnerStatus === "viewed" && "パートナーがリンクを確認しました"}
            {partnerStatus === "reacted" && "パートナーがリアクションしました"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            パートナーがリンクを開くと式場カードが表示されます
          </p>
        </div>
      )}
    </div>
  );
}
