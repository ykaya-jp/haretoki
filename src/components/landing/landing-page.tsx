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
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const staggerIn = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.14, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* ─── Hero Section ─── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        {/* Soft radial gradient background — sunrise warmth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.88 0.08 60 / 0.25), transparent), radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.75 0.12 45 / 0.12), transparent), radial-gradient(ellipse 50% 40% at 20% 80%, oklch(0.72 0.13 80 / 0.08), transparent)",
          }}
        />

        <motion.div
          className="relative z-10 mx-auto max-w-3xl space-y-10"
          initial="hidden"
          animate="visible"
        >
          {/* Logo — prominent */}
          <motion.p
            custom={0}
            variants={fadeUp}
            className="text-2xl font-medium uppercase tracking-[0.35em] text-[var(--gold-warm)] sm:text-3xl"
          >
            Harenohi
          </motion.p>

          {/* Headline — large, airy, serif */}
          <motion.h1
            custom={1}
            variants={fadeUp}
            className="font-serif text-[clamp(2.25rem,6vw,4rem)] font-light leading-[1.2] tracking-[0.06em] text-foreground"
          >
            二人で自然に、迷わず、
            <br />
            後悔なく式場を選べる
          </motion.h1>

          {/* Subhead */}
          <motion.p
            custom={2}
            variants={fadeUp}
            className="mx-auto max-w-lg text-base leading-[1.8] text-muted-foreground sm:text-lg"
          >
            AIコーチが好みを理解し、見積もりの落とし穴を先回りで教え、
            <br className="hidden sm:block" />
            パートナーとの意見のすり合わせを支援します。
          </motion.p>

          {/* CTAs */}
          <motion.div
            custom={3}
            variants={fadeUp}
            className="flex flex-col items-center gap-5 pt-4 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-12 py-4 text-base font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all duration-[400ms] hover:shadow-[0_12px_40px_rgba(196,129,110,0.45)] hover:-translate-y-1 active:scale-95"
            >
              無料ではじめる
              <ChevronRight className="h-4.5 w-4.5 transition-transform duration-[400ms] group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[56px] items-center gap-2 rounded-full border border-border px-12 py-4 text-base text-muted-foreground transition-all duration-[400ms] hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              ログイン
            </Link>
          </motion.div>

          {/* Trust signal */}
          <motion.p
            custom={4}
            variants={fadeUp}
            className="pt-2 text-sm tracking-wide text-muted-foreground/60"
          >
            無料で利用可能 · クレジットカード不要 · 3分でスタート
          </motion.p>
        </motion.div>

      </section>

      {/* ─── Stats Section ─── */}
      <section className="border-b border-border/50 bg-[var(--muted)] px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="mb-16 text-center text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            なぜ Harenohi が必要なのか
          </motion.p>
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-3 sm:gap-8">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.value}
                custom={i}
                variants={staggerIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="rounded-2xl bg-card/60 p-8 text-center shadow-[var(--shadow-card)] backdrop-blur-sm"
              >
                <p className="font-serif text-4xl font-light tracking-tight text-[var(--gold-warm)] sm:text-5xl">
                  {stat.value}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{stat.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Section ─── */}
      <section className="bg-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="mb-20 text-center font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light tracking-[0.06em]"
          >
            式場選びの「不安」を「確信」に変える
          </motion.h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10">
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
                  className="rounded-2xl border border-border/60 bg-card p-8 shadow-[var(--shadow-card)] transition-all duration-[400ms] ease-out hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 active:scale-[0.98] sm:p-10"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--gold-subtle)]">
                    <Icon className="h-7 w-7 text-[var(--gold-warm)]" />
                  </div>
                  <h3 className="mb-3 text-lg font-medium tracking-wide">{feature.title}</h3>
                  <p className="text-sm leading-[1.8] text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── AI Coach Preview ─── */}
      <section className="px-6 py-24 sm:py-32" style={{
        background: "linear-gradient(180deg, oklch(0.95 0.01 75) 0%, oklch(0.93 0.02 70) 50%, oklch(0.95 0.01 75) 100%)",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-[var(--gold-subtle)] px-5 py-2 text-sm text-[var(--gold-warm)]">
            <MessageSquare className="h-4 w-4" />
            AIコーチ
          </div>
          <h2 className="mb-6 font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light leading-snug tracking-[0.06em] text-foreground">
            3問答えるだけで、
            <br />
            あなたに合う式場が見つかります
          </h2>
          <p className="mx-auto mb-12 max-w-md text-base leading-[1.8] text-muted-foreground">
            好み・ゲスト人数・エリア・予算を伝えるだけ。
            <br className="hidden sm:block" />
            AIが最適な式場を提案します。
          </p>
          <Link
            href="/signup"
            className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-12 py-4 text-base font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all duration-[400ms] hover:shadow-[0_12px_40px_rgba(196,129,110,0.45)] hover:-translate-y-1 active:scale-95"
          >
            式場探しをはじめる
            <ChevronRight className="h-4.5 w-4.5 transition-transform duration-[400ms] group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-background px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-2xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)]">
            Harenohi
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            二人で自然に、迷わず、後悔なく式場を選べるプロダクト
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <Link href="/login" className="transition-colors duration-[400ms] hover:text-foreground">ログイン</Link>
            <Link href="/signup" className="transition-colors duration-[400ms] hover:text-foreground">新規登録</Link>
            <Link href="#" className="transition-colors duration-[400ms] hover:text-foreground">利用規約</Link>
            <Link href="#" className="transition-colors duration-[400ms] hover:text-foreground">プライバシーポリシー</Link>
          </div>
          <div className="mt-12 h-px w-full bg-border/40" />
          <p className="mt-8 text-xs text-muted-foreground/50">
            © 2026 Harenohi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
