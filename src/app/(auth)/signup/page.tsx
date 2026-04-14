"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight } from "lucide-react";
import { SeasonalMotif } from "@/components/ui/seasonal-motif";

export default function SignupPage() {
  const router = useRouter();
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
          setError("登録中にエラーが発生しました。もう一度お試しください");
        }
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("登録中にエラーが発生しました。もう一度お試しください");
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
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/icons/logo.png" alt="" width={40} height={40} className="h-10 w-10" />
          <Link href="/" className="text-2xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)] transition-opacity duration-200 hover:opacity-70">
            Haretoki
          </Link>
        </div>
        <div className="relative z-10 max-w-lg space-y-8">
          {/* Seasonal decoration — rotates monthly. */}
          <div className="flex justify-end">
            <SeasonalMotif size="md" className="opacity-60" />
          </div>
          <h1 className="font-serif text-[clamp(2rem,3.5vw,3rem)] font-light leading-snug tracking-[0.06em] text-foreground">
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
        </div>
        <p className="relative z-10 text-xs text-muted-foreground/50">
          © 2026 Haretoki
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-10">
          {/* Mobile header */}
          <div className="text-center lg:hidden">
            <Link href="/" className="text-xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)] transition-opacity duration-200 hover:opacity-70">
              Haretoki
            </Link>
            <h2 className="mt-4 font-serif text-2xl font-light tracking-[0.06em]">
              式場探し、はじめましょう
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              おふたりの理想の式場を見つける旅のスタートです
            </p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block">
            <h2 className="font-serif text-2xl font-light tracking-[0.06em]">アカウントを作成</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              無料で利用できます。3分で始められます。
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
                  準備中...
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
                  await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/callback` },
                  });
                } catch {
                  setOauthPending(false);
                }
              }}
            >
              {oauthPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Googleに移動中...
                </>
              ) : (
                "Googleで登録"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="font-medium text-primary underline underline-offset-4">
              ログイン
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
