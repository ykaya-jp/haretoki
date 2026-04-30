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

/** Compact "昨日 19:32" / "今日 07:14" formatter — matches design §3.2. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const hhmm = d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `今日 ${hhmm}`;
  if (isYesterday) return `昨日 ${hhmm}`;
  return d.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

/**
 * 4-dot progression: 送信 / 閲覧 / 反応 / 合流 — see design §3.2.
 * "反応" is a soft threshold (viewCount >= 2) since Level 1 cannot write
 * any real reaction data. It's purely UI feedback for the owner.
 */
function ProgressionDots({
  sent,
  viewed,
  reacted,
  joined,
  viewedAt,
  joinedAt,
}: {
  sent: boolean;
  viewed: boolean;
  reacted: boolean;
  joined: boolean;
  viewedAt?: string | null;
  joinedAt?: string | null;
}) {
  const steps = [
    { label: "送りました", active: sent, when: null as string | null },
    {
      label: "そっと見てくれました",
      active: viewed,
      when: viewed ? viewedAt ?? null : null,
    },
    {
      label: "ゆっくり見てくれています",
      active: reacted,
      when: reacted ? viewedAt ?? null : null,
    },
    {
      label: "ふたりの場所になりました",
      active: joined,
      when: joined ? joinedAt ?? null : null,
    },
  ];
  const activeIdx = [sent, viewed, reacted, joined].lastIndexOf(true);
  const activeLabel = activeIdx >= 0 ? steps[activeIdx].label : steps[0].label;
  const activeWhen =
    activeIdx >= 0 ? steps[activeIdx].when : null;

  return (
    <div className="mt-4 space-y-2">
      <div
        className="flex items-center gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={activeIdx + 1}
        aria-label="パートナーの合流ステップ"
      >
        {steps.map((s, i) => (
          <span key={i} className="flex flex-1 items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-[10px] w-[10px] rounded-full"
              style={{
                background: s.active
                  ? "var(--gold-warm)"
                  : "transparent",
                border: s.active
                  ? "1px solid var(--gold-warm)"
                  : "1px solid color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
              }}
            />
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="h-px flex-1"
                style={{
                  background: steps[i + 1].active
                    ? "var(--gold-warm)"
                    : "color-mix(in oklab, var(--muted-foreground) 20%, transparent)",
                }}
              />
            ) : null}
          </span>
        ))}
      </div>
      <p className="font-[family-name:var(--font-display)] text-[14px] font-light">
        {activeLabel}
      </p>
      {activeWhen ? (
        <p className="text-[11px] tabular-nums text-muted-foreground">
          {formatWhen(activeWhen)}
        </p>
      ) : null}
    </div>
  );
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
          <ProgressionDots
            sent={true}
            viewed={!!link.lastViewedAt}
            reacted={(link.viewCount ?? 0) >= 2}
            joined={!!link.joined}
            viewedAt={link.lastViewedAt}
            joinedAt={link.joinedAt ?? null}
          />
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
