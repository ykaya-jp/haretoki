import Link from "next/link";
import { Heart, BarChart3, Shield, MessageSquare, ChevronRight, Sparkles } from "lucide-react";

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

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      {/* ─── Hero Section ─── */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center bg-[var(--primary)] px-4 text-center">
        {/* Subtle gold gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            background: "radial-gradient(ellipse at 50% 30%, var(--gold-warm), transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl space-y-8">
          {/* Logo */}
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)]">
            VenueLens
          </p>

          {/* Headline */}
          <h1
            className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-light leading-[1.2] tracking-[0.04em] text-white"
          >
            二人で自然に、迷わず、
            <br />
            後悔なく式場を選べる
          </h1>

          {/* Subhead */}
          <p className="mx-auto max-w-xl text-base leading-relaxed text-white/70">
            AIコーチが好みを理解し、見積もりの落とし穴を先回りで教え、
            パートナーとの意見のすり合わせを支援します。
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-medium text-[var(--primary)] shadow-lg transition-transform active:scale-95"
            >
              無料ではじめる
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/20 px-8 py-3 text-sm text-white/80 transition-colors hover:bg-white/5 active:scale-95"
            >
              ログイン
            </Link>
          </div>

          {/* Trust signal */}
          <p className="text-xs text-white/40">
            無料で利用可能 · クレジットカード不要 · 3分でスタート
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="h-8 w-5 rounded-full border-2 border-white/20 p-1">
            <div className="h-2 w-1 rounded-full bg-white/40" />
          </div>
        </div>
      </section>

      {/* ─── Stats Section ─── */}
      <section className="border-b border-border bg-background px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            なぜ VenueLens が必要なのか
          </p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STATS.map((stat) => (
              <div key={stat.value} className="text-center">
                <p className="font-serif text-3xl font-light tracking-tight text-[var(--gold-warm)]">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-foreground">{stat.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
              </div>
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
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-all hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-1"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--gold-subtle)]">
                    <Icon className="h-5 w-5 text-[var(--gold-warm)]" />
                  </div>
                  <h3 className="mb-2 text-base font-medium">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── AI Coach Preview ─── */}
      <section className="bg-[var(--primary)] px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs text-[var(--gold-warm)]">
            <MessageSquare className="h-3.5 w-3.5" />
            AIコーチ
          </div>
          <h2 className="mb-4 font-serif text-2xl font-light leading-snug tracking-[0.04em] text-white">
            3問答えるだけで、
            <br />
            あなたに合う式場が見つかります
          </h2>
          <p className="mb-8 text-sm text-white/60">
            好み・ゲスト人数・エリア・予算を伝えるだけ。AIが最適な式場を提案します。
          </p>
          <Link
            href="/signup"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[var(--gold-warm)] px-8 py-3 text-sm font-medium text-white shadow-lg transition-transform active:scale-95"
          >
            式場探しをはじめる
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-background px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-serif text-lg text-foreground">VenueLens</p>
          <p className="mt-2 text-xs text-muted-foreground">
            二人で自然に、迷わず、後悔なく式場を選べるプロダクト
          </p>
          <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">ログイン</Link>
            <Link href="/signup" className="hover:text-foreground">新規登録</Link>
          </div>
          <p className="mt-8 text-[10px] text-muted-foreground/50">
            © 2026 VenueLens. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
