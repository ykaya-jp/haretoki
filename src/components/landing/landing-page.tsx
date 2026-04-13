"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, BarChart3, Shield, MessageSquare, ChevronRight, Sparkles, Eye, ClipboardCheck } from "lucide-react";
import { motion } from "framer-motion";

const STATS = [
  {
    value: "80%",
    description: "のカップルが、最初の見積もりから\n最終金額が上がっている",
    source: "リクルート ブライダル総研「結婚トレンド調査 2024」",
  },
  {
    value: "平均+110万円",
    description: "が初期見積もりからの平均上昇額。\n衣裳・装花・写真が主な要因",
    source: "ゼクシィ「結婚費用の相場 2024」",
  },
  {
    value: "2.8件",
    description: "が式場の平均検討数。\n限られた比較で一生の決断をしている",
    source: "リクルート ブライダル総研「結婚トレンド調査 2024」",
  },
];

const FEATURES = [
  {
    icon: Eye,
    title: "見積もりの「裏側」を可視化",
    description: "初期見積もりから最終金額まで、何がいくら上がるのかをAIが予測。「こんなはずじゃなかった」を防ぎます。",
  },
  {
    icon: ClipboardCheck,
    title: "見学で聞くべきことを漏らさない",
    description: "挙式会場・料理・衣裳・設備など、6カテゴリ63項目の見学チェックリスト。スマホを見ながら確認できます。",
  },
  {
    icon: Heart,
    title: "二人の「いいね」と「気になる」を比較",
    description: "パートナーと別々に評価して、意見が合うところ・違うところをAIが分析。話し合いのきっかけを作ります。",
  },
  {
    icon: BarChart3,
    title: "感覚ではなく、データで選ぶ",
    description: "雰囲気、料理、コスパなど6軸で式場を並べて比較。口コミのネガティブ情報も含めて、納得のいく判断を。",
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
      {/* ─── Hero ─── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        {/* Background chapel image with warm overlay */}
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/hero-chapel.png"
            alt=""
            fill
            className="object-cover opacity-[0.12]"
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
              alt="Harenohi"
              width={120}
              height={120}
              className="h-24 w-24 sm:h-28 sm:w-28"
            />
            <p className="text-2xl font-medium uppercase tracking-[0.35em] text-[var(--gold-warm)] sm:text-3xl">
              Harenohi
            </p>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fadeUp}
            className="font-serif text-[clamp(1.75rem,5vw,3.5rem)] font-light leading-[1.3] tracking-[0.06em] text-foreground"
          >
            式場選びを、
            <br />
            もっと納得のいくものに。
          </motion.h1>

          <motion.p
            custom={2}
            variants={fadeUp}
            className="mx-auto max-w-md text-[15px] leading-[2] text-muted-foreground"
          >
            見積もりの落とし穴を事前に把握し、
            <br />
            二人の意見を見える化して、
            <br />
            後悔のない式場選びを支援します。
          </motion.p>

          <motion.div
            custom={3}
            variants={fadeUp}
            className="flex flex-col items-center gap-5 pt-2 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-12 py-4 text-base font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all duration-[400ms] hover:shadow-[0_12px_40px_rgba(196,129,110,0.45)] hover:-translate-y-1 active:scale-95"
            >
              無料ではじめる
              <ChevronRight className="h-4 w-4 transition-transform duration-[400ms] group-hover:translate-x-1" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[56px] items-center gap-2 rounded-full border border-border px-12 py-4 text-base text-muted-foreground transition-all duration-[400ms] hover:border-foreground/30 hover:text-foreground active:scale-95"
            >
              ログイン
            </Link>
          </motion.div>

          <motion.p
            custom={4}
            variants={fadeUp}
            className="pt-2 text-sm tracking-wide text-muted-foreground/50"
          >
            無料 · カード登録不要 · 3分ではじめられます
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
            transition={{ duration: 0.7 }}
            className="mb-16 text-center"
          >
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              知っておきたい事実
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
                <p className="mt-4 whitespace-pre-line text-sm leading-[1.9] text-foreground">
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
            transition={{ duration: 0.7 }}
            className="mb-20 text-center"
          >
            <h2 className="font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light tracking-[0.06em]">
              Harenohiにできること
            </h2>
            <p className="mt-4 text-sm leading-[1.8] text-muted-foreground">
              「あのとき調べておけばよかった」をなくすために。
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
                  className="rounded-2xl border border-border/60 bg-card p-8 shadow-[var(--shadow-card)] transition-all duration-[400ms] ease-out hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1 active:scale-[0.98] sm:p-10"
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
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-[var(--gold-subtle)] px-5 py-2 text-sm text-[var(--gold-warm)]">
            <Sparkles className="h-4 w-4" />
            AIコーチ
          </div>
          <h2 className="mb-6 font-serif text-[clamp(1.5rem,3vw,2.5rem)] font-light leading-[1.4] tracking-[0.06em] text-foreground">
            3つの質問に答えるだけで、
            <br />
            あなたに合う式場が見えてきます
          </h2>
          <p className="mx-auto mb-12 max-w-sm text-[15px] leading-[2] text-muted-foreground">
            好み・ゲスト人数・エリア・予算を伝えるだけ。
            <br />
            AIが条件に合った式場を提案します。
          </p>
          <Link
            href="/signup"
            className="group inline-flex min-h-[56px] items-center gap-2.5 rounded-full bg-primary px-12 py-4 text-base font-medium text-primary-foreground shadow-[0_4px_24px_rgba(196,129,110,0.3)] transition-all duration-[400ms] hover:shadow-[0_12px_40px_rgba(196,129,110,0.45)] hover:-translate-y-1 active:scale-95"
          >
            式場探しをはじめる
            <ChevronRight className="h-4 w-4 transition-transform duration-[400ms] group-hover:translate-x-1" />
          </Link>
        </motion.div>
      </section>

      {/* ─── Commitment ─── */}
      <section className="bg-background px-6 py-24 sm:py-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-2xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-[var(--gold-subtle)] px-5 py-2 text-sm text-[var(--gold-warm)]">
            <Shield className="h-4 w-4" />
            私たちの約束
          </div>
          <h2 className="mb-6 font-serif text-[clamp(1.25rem,2.5vw,2rem)] font-light leading-[1.4] tracking-[0.06em]">
            Harenohiは、式場の広告ではありません
          </h2>
          <p className="text-[15px] leading-[2] text-muted-foreground">
            どの式場からも掲載料を受け取っていません。
            <br />
            カップルの「納得して選ぶ」を支援する、
            <br />
            中立なツールです。
          </p>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-[var(--muted)] px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)]">
            Harenohi
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            ふたりの式場選びパートナー
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <Link href="/login" className="transition-colors duration-[400ms] hover:text-foreground">
              ログイン
            </Link>
            <Link href="/signup" className="transition-colors duration-[400ms] hover:text-foreground">
              新規登録
            </Link>
            <Link href="#" className="transition-colors duration-[400ms] hover:text-foreground">
              利用規約
            </Link>
            <Link href="#" className="transition-colors duration-[400ms] hover:text-foreground">
              プライバシーポリシー
            </Link>
          </div>
          <div className="mt-12 h-px w-full bg-border/40" />
          <p className="mt-8 text-xs text-muted-foreground/40">
            © 2026 Harenohi
          </p>
        </div>
      </footer>
    </div>
  );
}
