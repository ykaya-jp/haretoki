"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { invitePartner } from "@/server/actions/invitations";

interface PartnerInviteProps {
  inviteLink: string;
  partnerStatus: "not_invited" | "invited" | "viewed" | "reacted" | "joined";
}

export function PartnerInvite({ inviteLink, partnerStatus }: PartnerInviteProps) {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("招待リンクをコピーしました");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Legacy fallback: select a temporary textarea and execCommand('copy').
      try {
        const ta = document.createElement("textarea");
        ta.value = inviteLink;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) {
          setCopied(true);
          toast.success("招待リンクをコピーしました");
          setTimeout(() => setCopied(false), 2000);
          return;
        }
      } catch {
        // fall through
      }
      toast.error("コピーできませんでした。リンクを長押しで選択してください");
    }
  };

  const handleLineShare = () => {
    // noopener,noreferrer prevents tabnabbing via window.opener.
    window.open(
      `https://line.me/R/share?text=${encodeURIComponent(`一緒に式場を選びませんか？\n${inviteLink}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isPending) return;
    startTransition(async () => {
      const result = await invitePartner(email.trim());
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("招待を作成しました。リンクをパートナーに共有してください");
      setEmail("");
    });
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
              <p className="text-xs text-muted-foreground">
                パートナーのメールアドレスで紐付けます。パートナーは同じメールでアカウント登録すると、リンクから参加できます。
              </p>
            </div>
          </div>
          <form onSubmit={handleInviteSubmit} className="space-y-2">
            <label htmlFor="partner-email" className="sr-only">
              パートナーのメールアドレス
            </label>
            <input
              id="partner-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@example.com"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              disabled={isPending}
            />
            <button
              type="submit"
              disabled={isPending || !email.trim()}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "招待を作成"
              )}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="text-center space-y-1">
            <p className="text-sm">
              {partnerStatus === "invited" && "招待を作成しました"}
              {partnerStatus === "viewed" && "パートナーがリンクを見てくれました"}
              {partnerStatus === "reacted" && "パートナーが反応してくれました"}
            </p>
            <p className="text-xs text-muted-foreground">
              同じメールアドレスで登録してもらい、このリンクから参加してもらってください。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleLineShare}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              LINEで送る
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm transition-all duration-200 active:scale-95"
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
