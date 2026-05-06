"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight } from "lucide-react";
import { SkyChip } from "@/components/home/sky-chip";
import { SeasonalMotif } from "@/components/ui/seasonal-motif";
import { isSameOriginRedirectPath } from "@/lib/url-guard";

/** W21-1 entry motion — mirrors login/page.tsx so the two auth screens
 *  feel like the same surface composing itself. */
const heroFadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "";
  // Same-origin relative path only — prevents open-redirect via signup ?next=
  const nextHref = isSameOriginRedirectPath(nextRaw) ? nextRaw : "/home";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("このメールアドレスは既に登録されています");
        } else {
          setError("うまくはじめられませんでした。もう一度お試しください");
        }
        return;
      }

      track("signup_completed", { method: "email" });
      router.push(nextHref);
      router.refresh();
    } catch {
      setError("うまくはじめられませんでした。もう一度お試しください");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Left: Brand panel (hidden on mobile) */}
      <div className="relative hidden flex-1 flex-col justify-between p-16 lg:flex overflow-hidden">
        {/* Floral pattern background */}
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/images/auth-pattern.png"
            alt=""
            fill
            className="object-cover opacity-40"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, oklch(0.97 0.01 80 / 0.7) 0%, oklch(0.95 0.01 75 / 0.6) 100%)",
            }}
          />
        </div>
        <motion.div
          custom={0}
          variants={heroFadeUp}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex items-center gap-3"
        >
          <Image src="/icons/logo.png" alt="" width={40} height={40} className="h-10 w-10" />
          <Link href="/" prefetch={true} className="text-2xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)] transition-opacity duration-200 hover:opacity-70">
            Haretoki
          </Link>
        </motion.div>
        <motion.div
          custom={1}
          variants={heroFadeUp}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-lg space-y-8"
        >
          {/* Seasonal decoration — rotates monthly. */}
          <div className="flex justify-end">
            <SeasonalMotif size="md" className="opacity-60" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,3.5vw,3rem)] font-light leading-snug tracking-[0.02em] text-foreground">
            式場探し、
            <br />
            はじめましょう
          </h1>
          <p className="text-base leading-[1.8] text-muted-foreground">
            おふたりの理想の式場を見つける旅のスタートです。
            <br />
            3問答えるだけで、AIがあなたに合う式場を提案します。
          </p>
          {/* Social proof */}
          <div className="space-y-4 rounded-2xl bg-[var(--gold-subtle)] p-6">
            <p className="text-sm font-medium text-[var(--gold-warm)]">知っていましたか？</p>
            <p className="text-sm leading-[1.8] text-foreground/80">
              80%のカップルが初期見積もりより平均
              <span className="font-medium text-[var(--gold-warm)]">+84〜110万円</span>
              上がっています。
              <br />
              Haretokiは、その「想定外」を事前に教えます。
            </p>
          </div>
        </motion.div>
        <p className="relative z-10 text-xs text-muted-foreground/50">
          © 2026 Haretoki
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <motion.div
          // W21-1: form panel fades in slightly behind the brand panel.
          custom={2}
          variants={heroFadeUp}
          initial="hidden"
          animate="visible"
          className="w-full max-w-sm space-y-10"
        >
          {/* Mobile header + SkyChip */}
          <div className="flex flex-col items-center gap-4 text-center lg:hidden">
            <SkyChip mood="break" size={40} />
            <div>
              <Link href="/" className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)] transition-opacity duration-200 hover:opacity-70">
                Haretoki
              </Link>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-light tracking-[0.01em]">
                式場探し、はじめましょう
              </h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                おふたりの理想の式場を、ここから描きはじめます。
              </p>
            </div>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-light tracking-[0.01em]">ふたりの場所を、はじめる</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              無料ではじめられます。3 分で準備できます。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2.5">
              <Label htmlFor="name">お名前</Label>
              <Input
                id="name"
                type="text"
                placeholder="山田 太郎"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                maxLength={50}
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="8文字以上"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  はじめています…
                </>
              ) : (
                <>
                  はじめる
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative py-3">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-4 text-muted-foreground">または</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={oauthPending || loading}
              onClick={async () => {
                setOauthPending(true);
                try {
                  const supabase = createClient();
                  const callbackUrl =
                    nextHref !== "/home"
                      ? `${window.location.origin}/callback?next=${encodeURIComponent(nextHref)}`
                      : `${window.location.origin}/callback`;
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: callbackUrl },
                  });
                } catch {
                  setOauthPending(false);
                }
              }}
            >
              {oauthPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Google に移動しています…
                </>
              ) : (
                "Google ではじめる"
              )}
            </Button>
          </form>

          {/* Terms-of-service consent notice — required for commercial
              readiness. Couples cannot finish signup without seeing
              that account creation implies agreement to /terms and
              /privacy, since the (auth) signup screen does not run
              inside the (app) layout that mounts SiteFooter. */}
          <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
            登録すると Haretoki の{" "}
            <Link
              href="/terms"
              prefetch={false}
              className="text-[var(--gold-warm)] underline underline-offset-2"
            >
              利用規約
            </Link>
            {" "}と{" "}
            <Link
              href="/privacy"
              prefetch={false}
              className="text-[var(--gold-warm)] underline underline-offset-2"
            >
              プライバシーポリシー
            </Link>
            {" "}に同意したものとみなします。
          </p>

          <p className="text-center text-sm text-muted-foreground">
            すでに場所をお持ちの方は{" "}
            <Link href="/login" prefetch={true} className="font-medium text-[var(--gold-warm)] underline underline-offset-2">
              ログインして戻る
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
