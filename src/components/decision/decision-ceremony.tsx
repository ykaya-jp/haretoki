"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { HaloTap } from "@/components/ui/halo-tap";

type CeremonyPhase = "celebration" | "summary" | "reason";

interface DecisionCeremonyProps {
  venueName: string;
  userName: string;
  journeyStats: {
    totalVenues: number;
    shortlisted: number;
    compared: number;
  };
  onRecordReason: (tags: string[], text: string) => Promise<void>;
}

const REASON_TAGS = ["雰囲気", "料理", "コスパ", "アクセス", "サービス", "設備"];

function formatJaDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}

export function DecisionCeremony({
  venueName,
  userName,
  journeyStats,
  onRecordReason,
}: DecisionCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("celebration");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (phase !== "celebration") return;

    // Longer linger — 2.6s — so the card breathes before summary.
    const timer = setTimeout(() => setPhase("summary"), 2600);

    let cancelled = false;
    const prefersReducedMotion = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (!prefersReducedMotion) {
      // Gentle confetti, delayed 900ms to align with card reveal.
      const confettiTimer = setTimeout(() => {
        void import("canvas-confetti").then((mod) => {
          if (cancelled) return;
          mod.default({
            particleCount: 28,
            spread: 55,
            startVelocity: 28,
            gravity: 0.9,
            ticks: 120,
            origin: { y: 0.42 },
            colors: ["#C9A84C", "#E8D89A", "#6B5D4D"],
          });
        });
      }, 900);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        clearTimeout(confettiTimer);
      };
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase]);

  const handleSaveReason = async (
    tags: string[] = selectedTags,
    text: string = reasonText,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      await onRecordReason(tags, text);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAll = () => {
    if (saving) return;
    void handleSaveReason([], "");
  };

  const handleShare = async () => {
    const text = `${venueName}に、決めました。#晴れ時`;
    if (typeof navigator === "undefined") return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "式場が決まりました", text });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // user cancelled or unsupported — silent no-op
    }
  };

  if (phase === "celebration") {
    const today = formatJaDate(new Date());
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReduced ? 0 : 0.5 }}
        className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6"
      >
        {/* Morning-light wash backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(80% 60% at 50% 30%, color-mix(in oklab, var(--gold-warm) 18%, transparent) 0%, transparent 70%)",
          }}
        />

        {/* Commemorative card */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{
            delay: prefersReduced ? 0 : 0.4,
            duration: prefersReduced ? 0 : 0.7,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative w-full max-w-[340px] rounded-[22px] bg-card/90 px-8 py-12 text-center backdrop-blur-sm"
          style={{
            border:
              "2px solid color-mix(in oklab, var(--gold-warm) 55%, transparent)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 64px color-mix(in oklab, var(--gold-warm) 16%, transparent), 0 2px 8px rgba(42,35,32,0.06)",
          }}
        >
          <p className="font-[family-name:var(--font-display)] text-[12.5px] uppercase tracking-[0.24em] text-[var(--gold-warm)]">
            ふたりが選んだ場所
          </p>

          <div
            aria-hidden="true"
            className="mx-auto mt-5 h-px w-10"
            style={{
              background:
                "linear-gradient(to right, transparent, color-mix(in oklab, var(--gold-warm) 60%, transparent), transparent)",
            }}
          />

          <h1 className="mt-5 font-[family-name:var(--font-display)] text-[30px] font-extralight leading-[1.25] tracking-[-0.005em] text-foreground">
            {venueName}
          </h1>

          <p className="mt-6 tabular-nums text-[13px] tracking-wider text-muted-foreground">
            {today}
          </p>
          {userName && (
            <p className="mt-1 text-[11.5px] text-muted-foreground/80">
              {userName}さん · おふたりの決定
            </p>
          )}
        </motion.div>

        {/* Bottom CTAs, appear after card */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReduced ? 0 : 1.1, duration: 0.5 }}
          className="mt-8 flex items-center gap-3"
        >
          <HaloTap className="rounded-full">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-11 items-center rounded-full px-5 text-[13px] font-medium tracking-wide transition active:scale-[0.98]"
              style={{
                background: "var(--gold-subtle)",
                color: "var(--gold-warm)",
                border:
                  "1px solid color-mix(in oklab, var(--gold-warm) 55%, transparent)",
              }}
            >
              この喜びをシェア
            </button>
          </HaloTap>
          <button
            type="button"
            onClick={() => setPhase("summary")}
            className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline"
          >
            次へ進む
          </button>
        </motion.div>
      </motion.div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="flex flex-col items-center gap-7 py-10">
        <div className="text-center">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            ふたりが選んだ場所
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-extralight tracking-[0.01em]">
            {venueName}
          </h2>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            おふたりの式場さがし
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
          <span>
            <span className="tabular-nums text-foreground">{journeyStats.totalVenues}</span> 件調べて
          </span>
          <span aria-hidden="true" className="opacity-40">→</span>
          <span>
            <span className="tabular-nums text-foreground">{journeyStats.shortlisted}</span> 件に絞り
          </span>
          <span aria-hidden="true" className="opacity-40">→</span>
          <span>
            <span className="tabular-nums text-foreground">{journeyStats.compared}</span> 件を比べて
          </span>
          <span aria-hidden="true" className="opacity-40">→</span>
          <span className="font-medium text-foreground">{venueName}に</span>
        </div>

        <HaloTap className="rounded-full">
          <button
            type="button"
            onClick={() => setPhase("reason")}
            disabled={saving}
            className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[14px] font-medium text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
            style={{
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.08), 0 8px 20px color-mix(in oklab, var(--primary) 20%, transparent)",
            }}
          >
            決めた理由を残す
          </button>
        </HaloTap>
        <button
          type="button"
          onClick={handleSkipAll}
          disabled={saving}
          className="min-h-11 text-[12.5px] text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          {saving ? "記録しています…" : "あとで記録する"}
        </button>
      </div>
    );
  }

  // Phase: reason
  return (
    <div className="space-y-7 py-8">
      <div className="text-center">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          記念に残す
        </p>
        <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-[18px] font-extralight tracking-wide">
          決め手を教えてください
        </h2>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {REASON_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() =>
              setSelectedTags((prev) =>
                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
              )
            }
            className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-[13px] transition-colors active:scale-95 ${
              selectedTags.includes(tag)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <textarea
        value={reasonText}
        onChange={(e) => setReasonText(e.target.value)}
        placeholder="この式場にした理由を、ひとこと"
        className="w-full rounded-2xl border border-border bg-card p-4 text-[14px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[var(--gold-warm)]/40"
        rows={3}
      />

      <div className="flex flex-col items-center gap-2">
        <HaloTap className="rounded-full">
          <button
            type="button"
            onClick={() => handleSaveReason()}
            disabled={saving}
            className="inline-flex h-12 items-center rounded-full bg-primary px-7 text-[14px] font-medium text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "記録しています…" : "この想いを残す"}
          </button>
        </HaloTap>
        <button
          type="button"
          onClick={handleSkipAll}
          disabled={saving}
          className="min-h-11 text-[12.5px] text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
        >
          あとで記録する
        </button>
      </div>
    </div>
  );
}
