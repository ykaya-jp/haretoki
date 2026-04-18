"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Copy, Check, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import {
  createInvitationLink,
  type InvitationLink,
} from "@/server/actions/invitation-links";

/**
 * E-11 1-tap Invitation Link panel.
 * Owner generates a one-time, 7-day-valid token link. Partner taps the link,
 * signs in with Google / email, and is auto-joined to the project (no email
 * pre-match needed).
 */
interface InviteLinkPanelProps {
  initialLink: InvitationLink | null;
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function InviteLinkPanel({ initialLink }: InviteLinkPanelProps) {
  const [link, setLink] = useState<InvitationLink | null>(initialLink);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      try {
        const fresh = await createInvitationLink();
        setLink(fresh);
        toast.success("招待リンクを作りました");
      } catch {
        toast.error("うまく作れませんでした");
      }
    });
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("リンクをコピーしました");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("うまくコピーできませんでした。長押しで選んでください");
    }
  };

  const handleLineShare = () => {
    if (!link) return;
    window.open(
      `https://line.me/R/share?text=${encodeURIComponent(`一緒に式場さがしを、はじめませんか？\n${link.url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section
      aria-label="1 タップ招待リンク"
      className="rounded-2xl border p-5"
      style={{
        background: "color-mix(in oklab, var(--gold-warm) 6%, var(--background))",
        borderColor: "color-mix(in oklab, var(--gold-warm) 25%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
          ふたりの場所への、1 タップ招待
        </p>
      </div>

      <h3 className="mt-2 font-[family-name:var(--font-display)] text-[17px] font-light tracking-[0.01em]">
        パートナーに、リンクを送る
      </h3>
      <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
        このリンクをタップすると、パートナーは Google などでサインインするだけで
        ふたりの場所に合流できます。メールアドレスの事前一致は不要です。
      </p>

      {link ? (
        <>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-[11px] font-mono text-foreground">
            <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {link.url}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-[12px] font-medium text-background transition active:scale-[0.96]"
              aria-label="リンクをコピー"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" strokeWidth={2} />
                  済
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" strokeWidth={1.6} />
                  コピー
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLineShare}
            className="mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] text-[14px] font-medium text-white"
            style={{ background: "#06C755" }}
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
            LINE で送る
          </button>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              有効期限: {formatExpiry(link.expiresAt)}
            </span>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending}
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCcw className="h-3 w-3" strokeWidth={1.6} />
              )}
              新しいリンクに作り直す
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-[var(--gold-warm)] text-[14px] font-medium text-white shadow-sm active:scale-[0.98] transition"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              作っています…
            </>
          ) : (
            "招待リンクを作る"
          )}
        </button>
      )}
    </section>
  );
}
