"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { HaloTap } from "@/components/ui/halo-tap";
import { VenueImage } from "@/components/ui/venue-image";
import { SkyChip } from "@/components/home/sky-chip";

type CeremonyPhase = "celebration" | "summary" | "reason";
// 曇り → 晴れ間 → 晴れの日 の 3 段階。ブランドメタファーそのもの。
type SkyStage = "cloudy" | "break" | "sunny";

interface DecisionCeremonyProps {
  venueName: string;
  userName: string;
  projectId?: string;
  photoUrl?: string | null;
  journeyStats: {
    totalVenues: number;
    shortlisted: number;
    compared: number;
  };
  onRecordReason: (tags: string[], text: string) => Promise<void>;
}

const REASON_TAGS = ["雰囲気", "料理", "コスパ", "アクセス", "サービス", "設備"];

// Celebration timings (ms). Total linger before summary = 3400ms.
// 押した瞬間から summary へ自動遷移するまでの呼吸を、3 段階の朝で区切る。
const TIMING = {
  cloudy: 0,          // 曇り — 不安の記憶
  breakIn: 900,       // 晴れ間 — 雲が割れて光が射す
  sunny: 1800,        // 晴れの日 — 確信の朝
  heroCardIn: 1900,   // 記念カードが立ち上がる
  confetti: 2250,     // 控えめに祝福
  ctaIn: 2900,        // 次の一歩を案内
  autoAdvance: 3400,  // summary へ
} as const;

function formatJaDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}年${m}月${day}日`;
}

export function DecisionCeremony({
  venueName,
  userName,
  projectId,
  photoUrl,
  journeyStats,
  onRecordReason,
}: DecisionCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("celebration");
  const [skyStage, setSkyStage] = useState<SkyStage>("cloudy");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (phase !== "celebration") return;

    // `prefersReduced` is already captured via `useReducedMotion()`
    // at the top of the component (line ~60). Re-reading via
    // `window.matchMedia` here was a leftover from before the hook
    // was added — it returned the same boolean but bypassed the
    // hook's runtime-toggle subscription, so a couple who flipped
    // their OS preference mid-ceremony would have stayed on the
    // motion path. Reusing the hook value keeps both branches
    // honest about the current preference state.

    // Reduced-motion path: skip the cloud→break→sunny sequence entirely,
    // show the hero card immediately, auto-advance fast.
    // Defer setSkyStage via rAF so it doesn't fire synchronously inside
    // the effect (React 19 cascading-render lint rule).
    if (prefersReduced) {
      const rafId = requestAnimationFrame(() => setSkyStage("sunny"));
      const quick = setTimeout(() => setPhase("summary"), 1400);
      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(quick);
      };
    }

    // Stage transitions: cloudy → break → sunny
    const breakT = setTimeout(() => setSkyStage("break"), TIMING.breakIn);
    const sunnyT = setTimeout(() => setSkyStage("sunny"), TIMING.sunny);
    const advanceT = setTimeout(() => setPhase("summary"), TIMING.autoAdvance);

    // Confetti after sunny peak — 28 particles only (DESIGN.md v4.2).
    // canvas-confetti loaded lazily to keep initial bundle small.
    let cancelled = false;
    const confettiT = setTimeout(() => {
      const root = getComputedStyle(document.documentElement);
      const pick = (name: string, fallback: string) =>
        root.getPropertyValue(name).trim() || fallback;
      const gold = pick("--gold-warm", "#C9A84C");
      const goldSoft = pick("--gold-light", "#E8D89A");
      const ink = pick("--foreground", "#6B5D4D");

      void import("canvas-confetti").then((mod) => {
        if (cancelled) return;
        mod.default({
          particleCount: 28,
          spread: 55,
          startVelocity: 28,
          gravity: 0.9,
          ticks: 120,
          origin: { y: 0.42 },
          colors: [gold, goldSoft, ink],
        });
      });
    }, TIMING.confetti);

    return () => {
      cancelled = true;
      clearTimeout(breakT);
      clearTimeout(sunnyT);
      clearTimeout(advanceT);
      clearTimeout(confettiT);
    };
  }, [phase, prefersReduced]);

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
    const shareUrl = projectId
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/decision/${projectId}`
      : undefined;
    if (typeof navigator === "undefined") return;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "式場が決まりました", text, url: shareUrl });
        return;
      }
      const copyText = shareUrl ? `${text}\n${shareUrl}` : text;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyText);
      }
    } catch {
      // user cancelled or unsupported — silent no-op
    }
  };

  if (phase === "celebration") {
    const today = formatJaDate(new Date());
    const hasPhoto = Boolean(photoUrl);

    // Background wash — three stacked radial gradients, each full-opacity
    // only when its stage is active. CSS opacity transitions cleanly across
    // stages (1.2s), while CSS cannot interpolate gradient strings directly.
    const washByStage: Record<SkyStage, string> = {
      cloudy:
        "radial-gradient(80% 60% at 50% 35%, color-mix(in oklab, var(--muted-foreground) 14%, transparent) 0%, transparent 70%)",
      break:
        "radial-gradient(80% 60% at 50% 32%, color-mix(in oklab, var(--gold-warm) 12%, transparent) 0%, color-mix(in oklab, var(--primary) 5%, transparent) 45%, transparent 80%)",
      sunny:
        "radial-gradient(80% 60% at 50% 30%, color-mix(in oklab, var(--gold-warm) 22%, transparent) 0%, color-mix(in oklab, var(--gold-light) 8%, transparent) 55%, transparent 80%)",
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReduced ? 0 : 0.4 }}
        className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6"
      >
        {/* Morning-light wash — three stacked gradient layers, each fading
            in/out by opacity as the sky stage progresses. CSS gradients
            cannot cross-fade their color stops, so we fade the containers
            themselves instead. */}
        {(["cloudy", "break", "sunny"] as const).map((stage) => (
          <div
            key={stage}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-1000 ease-out"
            style={{
              background: washByStage[stage],
              opacity: skyStage === stage ? 1 : 0,
            }}
          />
        ))}

        {/* Stage 1-2: SkyChip animating through cloudy → break → sunny.
            Fades out as the venue hero card rises. */}
        <AnimatePresence mode="wait">
          {skyStage !== "sunny" && !prefersReduced && (
            <motion.div
              key={skyStage}
              initial={{ opacity: 0, scale: 0.92, y: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.08, y: -16 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-[22%] flex flex-col items-center gap-3"
            >
              <SkyChip mood={skyStage} size={96} />
              <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                {skyStage === "cloudy" ? "迷いの朝" : "光が射してきた"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage 3: Venue hero card — rises from below after the sky clears.
            If a photo exists, it fills the card as atmospheric background
            with a soft darkened overlay so the venue name stays legible. */}
        <motion.div
          initial={
            prefersReduced ? false : { opacity: 0, scale: 0.94, y: 24 }
          }
          animate={
            skyStage === "sunny"
              ? { opacity: 1, scale: 1, y: 0 }
              : { opacity: 0, scale: 0.94, y: 24 }
          }
          transition={{
            duration: prefersReduced ? 0 : 0.9,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative w-full max-w-[340px] overflow-hidden rounded-[22px] text-center"
          style={{
            border:
              "2px solid color-mix(in oklab, var(--gold-warm) 55%, transparent)",
            background: hasPhoto
              ? "var(--card)"
              : "color-mix(in oklab, var(--card) 90%, transparent)",
            boxShadow:
              "0 1px 0 rgba(255,255,255,0.6) inset, 0 24px 64px color-mix(in oklab, var(--gold-warm) 18%, transparent), 0 2px 8px rgba(42,35,32,0.06)",
          }}
        >
          {/* Venue photo as atmospheric backdrop (optional) */}
          {hasPhoto && photoUrl && (
            <div className="relative h-[180px] w-full overflow-hidden">
              <VenueImage
                src={photoUrl}
                alt=""
                fill
                sizes="340px"
                tone="hero"
                className="object-cover"
                priority
              />
              {/* Bottom fade so the eyebrow/name below always read cleanly */}
              <div
                aria-hidden="true"
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, color-mix(in oklab, var(--foreground) 8%, transparent) 0%, transparent 40%, color-mix(in oklab, var(--card) 85%, transparent) 100%)",
                }}
              />
              {/* Soft gold sunlight glow from top-left — "morning light" */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(60% 50% at 20% 10%, color-mix(in oklab, var(--gold-warm) 25%, transparent), transparent 70%)",
                }}
              />
            </div>
          )}

          <div className={hasPhoto ? "px-8 pb-12 pt-7" : "px-8 py-12"}>
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

            <h1 className="mt-5 font-[family-name:var(--font-display)] text-[30px] font-light leading-[1.25] tracking-[-0.005em] text-foreground">
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
          </div>
        </motion.div>

        {/* Bottom CTAs — appear after the sunny stage settles */}
        <motion.div
          initial={prefersReduced ? false : { opacity: 0, y: 6 }}
          animate={
            skyStage === "sunny"
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 6 }
          }
          transition={{
            delay: prefersReduced ? 0 : 0.6,
            duration: 0.5,
          }}
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
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-[22px] font-light tracking-[0.01em]">
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
        <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-[18px] font-light tracking-wide">
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
