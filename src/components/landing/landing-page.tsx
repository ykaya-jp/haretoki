"use client";

import Link from "next/link";
import Image from "next/image";
import { VenueImage } from "@/components/ui/venue-image";
import { Heart, BarChart3, Shield, MessageSquare, ChevronRight, Sparkles, Eye, ClipboardCheck, Link2 } from "lucide-react";
import { motion } from "framer-motion";
import { DemoSequence } from "./demo-sequence";

const STATS = [
  {
    value: "80%",
    description: "が見積もりより高い金額を支払っている",
    source: "リクルート ブライダル総研「結婚トレンド調査 2024」",
  },
  {
    value: "+84〜110万円",
    description: "最初の見積もりから、ここまで上がる",
    source: "ゼクシィ「結婚費用の相場 2024」",
  },
  {
    value: "2.8件",
    description: "しか見学していない。比較は足りていますか",
    source: "リクルート ブライダル総研「結婚トレンド調査 2024」",
  },
];

const HERO_BENEFITS = [
  {
    icon: Link2,
    title: "URLを貼るだけで登録",
    subtext: "AIが式場情報を読み取ります",
  },
  {
    icon: BarChart3,
    title: "6軸×AIで比較",
    subtext: "雰囲気・料理・コスパまで並べて見れる",
  },
  {
    icon: ClipboardCheck,
    title: "見学リストで迷わない",
    subtext: "当日見落としを防ぐチェックリスト",
  },
];

const FEATURES = [
  {
    icon: Eye,
    title: "見積もりの先を読む",
    description: "衣装、装花、写真——上がりやすい項目をAIが先に教えます。",
  },
  {
    icon: ClipboardCheck,
    title: "見学で見落とさない",
    description: "6カテゴリ63項目のリスト。当日スマホで確認するだけ。",
  },
  {
    icon: Heart,
    title: "ふたりの本音を並べる",
    description: "別々に評価して、AIが比較。合う点もズレも見えてきます。",
  },
  {
    icon: BarChart3,
    title: "数字で選ぶ、感覚も活かす",
    description: "6軸のデータ比較と口コミ分析。納得できる判断材料を。",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 1.0, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const staggerIn = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.18, duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* ─── Hero ─── */}
      <section className="hero-sunlight relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        {/* Background chapel image with warm overlay */}
        <div className="pointer-events-none absolute inset-0">
          <VenueImage
            src="/images/hero-chapel.png"
            alt=""
            fill
            tone="hero"
            className="object-cover opacity-[0.18]"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 30%, oklch(0.97 0.01 80 / 0.9), transparent), radial-gradient(ellipse 60% 50% at 80% 70%, oklch(0.75 0.12 45 / 0.08), transparent)",
            }}
          />
        </div>

        <motion.div
          className="relative z-10 mx-auto max-w-2xl space-y-10"
          initial="hidden"
          animate="visible"
        >
          <motion.div
            custom={0}
            variants={fadeUp}
            className="flex flex-col items-center gap-3"
          >
            <Image
              src="/icons/logo.png"
              alt="Haretoki"
              width={160}
              height={160}
              priority
              className="h-36 w-36 sm:h-40 sm:w-40"
            />
            <p className="text-2xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)] sm:text-3xl">
              Haretoki
            </p>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUp}
            className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,5vw,3.5rem)] font-extralight leading-[1.2] tracking-[-0.015em] text-foreground"
          >
            その直感、
            <br />
            信じていい日にする。
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            className="mx-auto max-w-md text-[15px] leading-[2] text-muted-foreground"
          >
            見積もりの不透明さも、
            <br />
            比較しきれない不安も。
            <br />
            ここで、晴れにできます。
          </motion.p>

          <motion.ul
            custom={3}
            variants={fadeUp}
            className="mx-auto w-full max-w-xl space-y-3 rounded-2xl border border-[var(--gold-warm)]/15 bg-[var(--gold-subtle)]/30 p-5 text-left backdrop-blur-sm md:grid md:grid-cols-3 md:gap-4 md:space-y-0"
          >
            {HERO_BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <li
                  key={benefit.title}
                  className="flex items-start gap-3 md:flex-col md:items-center md:gap-2 md:text-center"
                >
                  <Icon
                    className="h-5 w-5 shrink-0 text-[var(--gold-warm)] mt-0.5 md:mt-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {benefit.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {benefit.subtext}
                    </p>
                  </div>
                </li>
              );
            })}
          </motion.ul>

          <motion.div
            custom={4}
            variants={fadeUp}
            className="flex flex-col items-center gap-5 pt-2 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-12 py-4 text-base font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all duration-200 hover:shadow-[0_12px_40px_rgba(196,129,110,0.45)] hover:-translate-y-1 active:scale-95"
            >
              無料ではじめる
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[56px] items-center gap-2 rounded-full border border-border px-12 py-4 text-base text-muted-foreground transition-all duration-200 hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              ログイン
            </Link>
          </motion.div>

          <motion.div custom={5} variants={fadeUp} className="pt-1">
            {/* Subtle secondary CTA — lets visitors try the app without signing up */}
            <Link
              href="/demo"
              className="inline-flex min-h-[44px] items-center gap-1 px-2 py-2.5 text-sm text-muted-foreground underline decoration-[var(--gold-warm)]/40 decoration-dotted underline-offset-[6px] transition-colors duration-200 hover:text-foreground hover:decoration-[var(--gold-warm)]"
            >
              まずは体験してみる
              <ChevronRight className="h-3.5 w-3.5 text-[var(--gold-warm)]" aria-hidden="true" />
            </Link>
          </motion.div>

          <motion.p
            custom={5}
            variants={fadeUp}
            className="pt-2 text-sm tracking-wide text-muted-foreground/50"
          >
            無料 · カード不要 · 3分で開始
          </motion.p>
        </motion.div>
      </section>

      {/* ─── Problem Statement ─── */}
      <section className="border-b border-border/50 bg-[var(--muted)] px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 text-center"
          >
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              知っておきたい数字
            </p>
          </motion.div>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
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
                <p className="font-serif text-3xl font-light tracking-tight text-[var(--gold-warm)] sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-4 text-sm leading-[1.9] text-foreground">
                  {stat.description}
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/60">
                  {stat.source}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="bg-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mb-20 text-center"
          >
            <h2 className="font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light tracking-[0.06em]">
              不安を、安心に変える
            </h2>
            <p className="mt-4 text-sm leading-[1.8] text-muted-foreground">
              式場選びの「見えない」を、見える形に。
            </p>
          </motion.div>
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
                  className="rounded-2xl border border-border/60 bg-card p-8 shadow-[var(--shadow-card)] transition-all duration-200 ease-out hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 active:scale-[0.98] sm:p-10"
                >
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--gold-subtle)]">
                    <Icon className="h-7 w-7 text-[var(--gold-warm)]" />
                  </div>
                  <h3 className="mb-3 text-lg font-medium tracking-wide">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-[1.9] text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="border-y border-border/30 bg-[var(--muted)] px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mb-16 text-center"
          >
            <h2 className="font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light tracking-[0.06em]">
              はじめかた
            </h2>
          </motion.div>

          <div className="flex flex-col items-center gap-16 md:flex-row md:items-center md:justify-between md:gap-12">
            {/* Steps — left column on md+ */}
            <ol className="flex w-full flex-col gap-10 md:max-w-sm md:flex-1">
              {[
                { step: "01", title: "式場を登録する", desc: "URLを貼るだけ。情報はAIが読み取ります。" },
                { step: "02", title: "見学して記録する", desc: "リストに沿って確認。印象をその場で残せます。" },
                { step: "03", title: "並べて、決める", desc: "データと気持ち、両方を見て選べます。" },
              ].map((item, i) => (
                <motion.li
                  key={item.step}
                  custom={i}
                  variants={staggerIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  className="text-center md:text-left"
                >
                  <p className="text-3xl font-light text-[var(--gold-warm)] sm:text-4xl">{item.step}</p>
                  <h3 className="mt-4 text-base font-medium tracking-wide">{item.title}</h3>
                  <p className="mt-2 text-sm leading-[1.8] text-muted-foreground">{item.desc}</p>
                </motion.li>
              ))}
            </ol>

            {/* Animated phone mockup — right column on md+ */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="w-full md:flex-1"
            >
              <DemoSequence />
            </motion.div>
          </div>

          {/* Secondary CTA — try the app without signing up */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mt-16 flex justify-center"
          >
            <Link
              href="/demo"
              className="group inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[var(--gold-warm)]/30 bg-card px-8 py-3 text-sm text-foreground shadow-sm transition-all duration-200 hover:border-[var(--gold-warm)]/60 hover:shadow-md active:scale-95"
            >
              実際に触ってみる
              <ChevronRight className="h-4 w-4 text-[var(--gold-warm)] transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ─── AI Coach ─── */}
      <section
        className="px-6 py-24 sm:py-32"
        style={{
          background:
            "linear-gradient(180deg, oklch(0.95 0.01 75) 0%, oklch(0.93 0.02 70) 50%, oklch(0.95 0.01 75) 100%)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-[var(--gold-subtle)] px-5 py-2 text-sm text-[var(--gold-warm)]">
            <Sparkles className="h-4 w-4" />
            AIコーチ
          </div>
          <h2 className="mb-6 font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light leading-[1.4] tracking-[0.06em] text-foreground">
            好みを話すだけで、
            <br />
            候補が見えてくる
          </h2>
          <p className="mx-auto mb-12 max-w-sm text-[15px] leading-[2] text-muted-foreground">
            3つの質問に答えるだけ。
            <br />
            AIがふたりに合う式場を提案します。
          </p>
          <Link
            href="/signup"
            className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-12 py-4 text-base font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all duration-200 hover:shadow-[0_12px_40px_rgba(196,129,110,0.45)] hover:-translate-y-1 active:scale-95"
          >
            式場探しをはじめる
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>

      {/* ─── Commitment ─── */}
      <section className="bg-background px-6 py-24 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-[var(--gold-subtle)] px-5 py-2 text-sm text-[var(--gold-warm)]">
            <Shield className="h-4 w-4" />
            私たちの約束
          </div>
          <h2 className="mb-6 font-serif text-[clamp(1.25rem,2.5vw,2rem)] font-light leading-[1.4] tracking-[0.06em]">
            広告のない、
            <br />
            ふたりだけの判断材料
          </h2>
          <p className="text-[15px] leading-[2] text-muted-foreground">
            式場からの掲載料は受け取りません。
            <br />
            だから、本当に合う場所だけを選べます。
          </p>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[var(--muted)] px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)]">
            Haretoki
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            曇りのち、晴れの日へ
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center px-3 transition-colors duration-200 hover:text-foreground"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[44px] items-center px-3 transition-colors duration-200 hover:text-foreground"
            >
              新規登録
            </Link>
            <span className="inline-flex min-h-[44px] cursor-not-allowed items-center px-3 text-muted-foreground opacity-60">
              利用規約（準備中）
            </span>
            <span className="inline-flex min-h-[44px] cursor-not-allowed items-center px-3 text-muted-foreground opacity-60">
              プライバシーポリシー（準備中）
            </span>
          </div>
          <div className="mt-12 h-px w-full bg-border/40" />
          <p className="mt-8 text-xs text-muted-foreground/40">
            © 2026 Haretoki
          </p>
        </div>
      </footer>
    </div>
  );
}
