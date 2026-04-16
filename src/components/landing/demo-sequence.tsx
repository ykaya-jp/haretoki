"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Link2,
  Sparkles,
  Star,
  Crown,
  Check,
  MapPin,
  Users,
  Pause,
  Play,
} from "lucide-react";

/**
 * DemoSequence — landing page "How It Works" animated phone mockup.
 *
 * Shows 4 steps in a 5-second loop:
 *   1. URL paste (typing animation)
 *   2. Card generation (venue card materializes)
 *   3. Rating (6 dimensions, stars filling to 4.2)
 *   4. Comparison + decision (side-by-side, crown, CTA pulse)
 *
 * Respects prefers-reduced-motion (renders all steps as a static list).
 * Pauses when off-screen (IntersectionObserver) or on user request.
 */

const STEP_DURATION_MS = 5000;
const STEP_COUNT = 4;

const RATING_DIMENSIONS = [
  { label: "雰囲気", value: 4.6 },
  { label: "料理", value: 4.3 },
  { label: "サービス", value: 4.5 },
  { label: "コスパ", value: 3.8 },
  { label: "設備", value: 4.1 },
  { label: "アクセス", value: 3.9 },
];

const URL_TEXT = "https://zexy.net/wedding/...";

export function DemoSequence() {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pause when off-screen
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Auto-advance
  useEffect(() => {
    if (prefersReducedMotion || paused || !visible) return;
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEP_COUNT);
    }, STEP_DURATION_MS);
    return () => window.clearInterval(id);
  }, [prefersReducedMotion, paused, visible]);

  // Static fallback for reduced motion — show all four steps vertically.
  if (prefersReducedMotion) {
    return (
      <div
        ref={containerRef}
        role="img"
        aria-label="Haretoki の使い方の概要"
        className="mx-auto flex w-full max-w-[320px] flex-col gap-4"
      >
        <StepFrame active>
          <UrlPasteStep typedLength={URL_TEXT.length} showLoading={false} />
        </StepFrame>
        <StepFrame active>
          <CardStep show />
        </StepFrame>
        <StepFrame active>
          <RatingStep progress={1} />
        </StepFrame>
        <StepFrame active>
          <CompareStep show />
        </StepFrame>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Haretoki の使い方の概要アニメーション"
      className="mx-auto flex w-full max-w-[340px] flex-col items-center gap-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <PhoneFrame>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            {step === 0 && <Step1 />}
            {step === 1 && <Step2 />}
            {step === 2 && <Step3 />}
            {step === 3 && <Step4 />}
          </motion.div>
        </AnimatePresence>
      </PhoneFrame>

      {/* Step indicator + pause control */}
      <div className="flex w-full items-center justify-between px-2">
        <div className="flex gap-1.5" aria-hidden="true">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 bg-[var(--gold-warm)]"
                  : "w-1.5 bg-[var(--gold-warm)]/25"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className="inline-flex h-11 min-w-[44px] items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-4 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          aria-label={paused ? "アニメーション再開" : "アニメーション停止"}
        >
          {paused ? (
            <Play className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Pause className="h-3 w-3" aria-hidden="true" />
          )}
          {paused ? "再開" : "停止"}
        </button>
      </div>
    </div>
  );
}

// ─── Phone frame ─────────────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative h-[520px] w-[260px] overflow-hidden rounded-[40px] border border-border/60 bg-background"
      style={{ boxShadow: "var(--shadow-hero)" }}
    >
      {/* Notch */}
      <div className="absolute left-1/2 top-2 z-20 h-1.5 w-16 -translate-x-1/2 rounded-full bg-foreground/15" />
      {/* Screen */}
      <div className="absolute inset-[6px] overflow-hidden rounded-[34px] bg-[var(--muted)]">
        <div className="relative h-full w-full">{children}</div>
      </div>
    </div>
  );
}

// Small wrapper for the reduced-motion static fallback.
function StepFrame({
  children,
  active,
}: {
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <div
      className={`relative h-[260px] w-full overflow-hidden rounded-2xl border border-border/60 bg-card p-4 ${
        active ? "" : "opacity-50"
      }`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </div>
  );
}

// ─── Step 1 — URL paste ──────────────────────────────────────────────────

function Step1() {
  const [typed, setTyped] = useState(0);
  const total = URL_TEXT.length;

  useEffect(() => {
    const id = window.setInterval(() => {
      setTyped((t) => (t >= total ? t : t + 1));
    }, 90);
    return () => window.clearInterval(id);
  }, [total]);

  return <UrlPasteStep typedLength={typed} showLoading={typed >= total} />;
}

function UrlPasteStep({
  typedLength,
  showLoading,
}: {
  typedLength: number;
  showLoading: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold-subtle)]">
          <Link2 className="h-4 w-4 text-[var(--gold-warm)]" aria-hidden="true" />
        </div>
        <p className="text-[13px] font-medium text-foreground">式場を追加</p>
      </div>

      <label className="text-[11px] text-muted-foreground">式場ページのURL</label>
      <div className="relative rounded-xl border border-[var(--gold-warm)]/40 bg-card px-3 py-3 shadow-sm">
        <p className="font-mono text-[12px] tracking-tight text-foreground">
          {URL_TEXT.slice(0, typedLength)}
          <span className="ml-px inline-block h-3.5 w-[1.5px] animate-pulse bg-[var(--gold-warm)] align-middle" />
        </p>
      </div>

      <button
        type="button"
        className="mt-auto inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-medium text-primary-foreground shadow-[0_4px_16px_rgba(196,129,110,0.28)]"
        disabled
        aria-hidden="true"
      >
        {showLoading ? (
          <>
            <LoadingDots />
            読み取り中
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            読み取る
          </>
        )}
      </button>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-1 w-1 rounded-full bg-primary-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

// ─── Step 2 — card generation ────────────────────────────────────────────

function Step2() {
  return <CardStep show />;
}

function CardStep({ show }: { show: boolean }) {
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--gold-warm)]">
        <Check className="h-3 w-3" aria-hidden="true" />
        AI が情報を読み取りました
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-card)]"
      >
        {/* Photo placeholder — gold gradient */}
        <div
          className="relative aspect-[3/2] w-full"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.92 0.05 80) 0%, oklch(0.78 0.11 65) 60%, oklch(0.70 0.13 80) 100%)",
          }}
        >
          <div className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              background:
                "radial-gradient(ellipse at 30% 20%, oklch(1 0 0 / 0.5), transparent 60%)",
            }}
          />
          <div className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-[var(--gold-warm)] backdrop-blur">
            ¥ 3.2M〜
          </div>
        </div>

        <div className="space-y-2 p-3">
          <p className="font-[family-name:var(--font-display)] text-[15px] font-light leading-snug tracking-wide text-foreground">
            アーカンジェル青山
          </p>
          <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              東京・青山
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              80名
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step 3 — rating ─────────────────────────────────────────────────────

function Step3() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <RatingStep progress={progress} />;
}

function RatingStep({ progress }: { progress: number }) {
  const avg = 4.2 * progress;
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-medium text-foreground">評価</p>
        <p className="font-[family-name:var(--font-display)] text-[22px] font-light text-[var(--gold-warm)] tabular-nums">
          {avg.toFixed(1)}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {RATING_DIMENSIONS.map((dim, i) => (
          <li
            key={dim.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-[11px] text-muted-foreground">{dim.label}</span>
            <StarRow value={dim.value * progress} delay={i} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StarRow({ value }: { value: number; delay: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <div key={n} className="relative h-3 w-3">
            <Star className="absolute inset-0 h-3 w-3 text-[var(--gold-warm)]/25" />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${filled * 100}%` }}
            >
              <Star className="h-3 w-3 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 4 — compare & decide ───────────────────────────────────────────

function Step4() {
  return <CompareStep show />;
}

function CompareStep({ show }: { show: boolean }) {
  const rows = [
    { label: "総合", a: "4.2", b: "3.9", winner: "a" as const },
    { label: "コスパ", a: "3.8", b: "4.1", winner: "b" as const },
    { label: "料理", a: "4.3", b: "4.0", winner: "a" as const },
  ];

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="text-[12px] font-medium text-foreground">比較</p>

      <div className="grid grid-cols-[64px_1fr_1fr] gap-1 text-center">
        <div />
        <p className="truncate font-[family-name:var(--font-display)] text-[11px] font-light tracking-wide text-foreground">
          青山
        </p>
        <p className="truncate font-[family-name:var(--font-display)] text-[11px] font-light tracking-wide text-foreground">
          表参道
        </p>

        {rows.map((row, idx) => (
          <RowCells key={row.label} row={row} show={show} index={idx} />
        ))}
      </div>

      <motion.button
        type="button"
        disabled
        aria-hidden="true"
        className="mt-auto inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-medium text-primary-foreground shadow-[0_4px_16px_rgba(196,129,110,0.28)]"
        animate={
          show
            ? {
                boxShadow: [
                  "0 4px 16px rgba(196,129,110,0.28)",
                  "0 8px 28px rgba(196,129,110,0.48)",
                  "0 4px 16px rgba(196,129,110,0.28)",
                ],
              }
            : {}
        }
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        この式場に決める
      </motion.button>
    </div>
  );
}

function RowCells({
  row,
  show,
  index,
}: {
  row: { label: string; a: string; b: string; winner: "a" | "b" };
  show: boolean;
  index: number;
}) {
  const baseDelay = 0.15 + index * 0.12;
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
        transition={{ duration: 0.5, delay: baseDelay }}
        className="flex items-center justify-end pr-1 text-[10px] text-muted-foreground"
      >
        {row.label}
      </motion.div>
      <Cell value={row.a} isWinner={row.winner === "a"} show={show} delay={baseDelay + 0.05} />
      <Cell value={row.b} isWinner={row.winner === "b"} show={show} delay={baseDelay + 0.1} />
    </>
  );
}

function Cell({
  value,
  isWinner,
  show,
  delay,
}: {
  value: string;
  isWinner: boolean;
  show: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      transition={{ duration: 0.5, delay }}
      className={`relative rounded-lg border px-2 py-1.5 font-[family-name:var(--font-display)] text-[13px] font-light tabular-nums ${
        isWinner
          ? "border-[var(--gold-warm)]/40 bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
          : "border-border/50 bg-card text-muted-foreground"
      }`}
    >
      {value}
      {isWinner && (
        <Crown
          className="absolute -right-1 -top-1.5 h-3 w-3 text-[var(--gold-warm)]"
          aria-hidden="true"
          fill="currentColor"
        />
      )}
    </motion.div>
  );
}
