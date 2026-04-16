"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { SeasonalMotif } from "@/components/ui/seasonal-motif";
import { SkyChip } from "@/components/home/sky-chip";
import { isSameOriginRedirectPath } from "@/lib/url-guard";

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary for static generation.
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next") ?? "";
  const nextHref = isSameOriginRedirectPath(nextRaw) ? nextRaw : "/home";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  // Callback redirects here with ?error=auth on OAuth failure.
  useEffect(() => {
    if (searchParams.get("error") === "auth") {
      setError("ログインがうまくいきませんでした。もう一度お試しください");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      router.push(nextHref);
      router.refresh();
    } catch {
      setError("ログインがうまくいきませんでした。もう一度お試しください");
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
          <Link href="/" prefetch={true} className="text-2xl font-medium uppercase tracking-[0.3em] text-[var(--gold-warm)] transition-opacity duration-200 hover:opacity-70">
            Haretoki
          </Link>
        </div>
        <div className="relative z-10 max-w-lg">
          {/* Seasonal decoration — rotates monthly. Top-right of heading. */}
          <div className="mb-4 flex justify-end">
            <SeasonalMotif size="md" className="opacity-60" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2rem,3.5vw,3rem)] font-extralight leading-snug tracking-[0.02em] text-foreground">
            おかえりなさい
          </h1>
          <p className="mt-6 text-base leading-[1.8] text-muted-foreground">
            式場探しの続きを始めましょう。
            <br />
            AIコーチがあなたの進捗を覚えています。
          </p>
        </div>
        <p className="relative z-10 text-xs text-muted-foreground/50">
          © 2026 Haretoki
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm space-y-10">
          {/* Mobile logo + SkyChip */}
          <div className="flex flex-col items-center gap-4 text-center lg:hidden">
            <SkyChip mood="sunny" size={40} />
            <div>
              <Link href="/" className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)] transition-opacity duration-200 hover:opacity-70">
                Haretoki
              </Link>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-extralight tracking-[0.01em]">ログイン</h2>
            </div>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block">
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-extralight tracking-[0.01em]">おかえりなさい</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              メールアドレスとパスワードを入れて、ふたりの場所に戻りましょう
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

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
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ログイン中...
                </>
              ) : (
                "ログイン"
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
                "Google で入る"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            はじめての方は{" "}
            <Link href="/signup" prefetch={true} className="font-medium text-primary underline underline-offset-4">
              ふたりの場所をつくる
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
