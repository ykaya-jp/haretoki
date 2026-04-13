"use client";

import Link from "next/link";
import { Heart, BarChart3, Shield, MessageSquare, ChevronRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const STATS = [
  { value: "80%", label: "のカップルが初期見積もりより上がる", sub: "平均+100万円" },
  { value: "2.6件", label: "しか式場を見学しない", sub: "平均" },
  { value: "68.5%", label: "が式場選びのプロセスに後悔", sub: "Wedding Table調査" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AIが見積もりの落とし穴を先回り",
    description: "見積もりの「上がりやすい項目」を統計データに基づいて警告。80%のカップルが経験する追加費用を事前に把握できます。",
  },
  {
    icon: BarChart3,
    title: "データで納得できる比較",
    description: "6つの評価軸で式場を並べて比較。感覚ではなく、データに基づいた式場選びができます。",
  },
  {
    icon: Heart,
    title: "二人の意見を見える化",
    description: "パートナーと独立して評価し、一致点と相違点をAIが分析。「話し合うべきポイント」が一目でわかります。",
  },
  {
    icon: Shield,
    title: "中立な立場で支援",
    description: "広告モデルではありません。どの式場からも費用を受け取らず、カップルの「選ぶ」を支援する中立ツールです。",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const staggerIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function LandingPage() {
  return (
    <div className="min-h-dvh">
      {/* ─── Hero Section ─── */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center bg-background px-4 text-center">
        {/* Warm gradient overlay — sunrise feel */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 20%, oklch(0.85 0.08 60 / 0.15), transparent 60%), radial-gradient(ellipse at 80% 80%, oklch(0.70 0.13 80 / 0.08), transparent 50%)",
          }}
        />

        <motion.div
          className="relative z-10 mx-auto max-w-3xl space-y-8"
          initial="hidden"
          animate="visible"
        >
          {/* Logo */}
          <motion.p
            custom={0}
            variants={fadeUp}
            className="text-sm font-medium uppercase tracking-[0.25em] text-[var(--gold-warm)]"
          >
            Harenohi
          </motion.p>

          {/* Headline */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.15] tracking-[0.04em] text-foreground"
          >
            二人で自然に、迷わず、
            <br />
            後悔なく式場を選べる
          </motion.h1>

          {/* Subhead */}
          <motion.p
            custom={2}
            variants={fadeUp}
            className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground"
          >
            AIコーチが好みを理解し、見積もりの落とし穴を先回りで教え、
            パートナーとの意見のすり合わせを支援します。
          </motion.p>

          {/* CTAs */}
          <motion.div
            custom={3}
            variants={fadeUp}
            className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className="group inline-flex min-h-[52px] items-center gap-2 rounded-full bg-primary px-10 py-3.5 text-sm font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all hover:shadow-[0_8px_32px_rgba(196,129,110,0.45)] hover:-translate-y-0.5 active:scale-95"
            >
              無料ではじめる
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-border px-10 py-3.5 text-sm text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              ログイン
            </Link>
          </motion.div>

          {/* Trust signal */}
          <motion.p custom={4} variants={fadeUp} className="text-xs text-muted-foreground/60">
            無料で利用可能 · クレジットカード不要 · 3分でスタート
          </motion.p>
        </motion.div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="h-8 w-5 rounded-full border-2 border-foreground/15 p-1">
            <div className="h-2 w-1 rounded-full bg-foreground/25" />
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section className="border-b border-border bg-[var(--muted)] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            なぜ Harenohi が必要なのか
          </p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.value}
                custom={i}
                variants={staggerIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="text-center"
              >
                <p className="font-serif text-3xl font-light tracking-tight text-[var(--gold-warm)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-foreground">{stat.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="bg-background px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-fluid-xl">
            式場選びの「不安」を「確信」に変える
          </h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  custom={i}
                  variants={staggerIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 active:scale-[0.98]"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gold-subtle)]">
                    <Icon className="h-5 w-5 text-[var(--gold-warm)]" />
                  </div>
                  <h3 className="mb-2 text-base font-medium">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── AI Coach Preview ─── */}
      <section className="bg-[var(--muted)] px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold-subtle)] px-4 py-1.5 text-xs text-[var(--gold-warm)]">
            <MessageSquare className="h-3.5 w-3.5" />
            AIコーチ
          </div>
          <h2 className="mb-4 font-serif text-2xl font-light leading-snug tracking-[0.04em] text-foreground">
            3問答えるだけで、
            <br />
            あなたに合う式場が見つかります
          </h2>
          <p className="mb-8 text-sm text-muted-foreground">
            好み・ゲスト人数・エリア・予算を伝えるだけ。AIが最適な式場を提案します。
          </p>
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 active:scale-95"
          >
            式場探しをはじめる
            <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-background px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-serif text-lg text-foreground">Harenohi</p>
          <p className="mt-2 text-xs text-muted-foreground">
            二人で自然に、迷わず、後悔なく式場を選べるプロダクト
          </p>
          <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">ログイン</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">新規登録</Link>
          </div>
          <p className="mt-8 text-[10px] text-muted-foreground/50">
            © 2026 Harenohi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
