"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronRight } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <div className="hidden flex-1 flex-col justify-between bg-[var(--primary)] p-12 lg:flex">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)]">
            Harenohi
          </p>
        </div>
        <div className="max-w-md space-y-6">
          <h1 className="font-serif text-3xl font-light leading-snug tracking-[0.04em] text-white">
            式場探し、
            <br />
            はじめましょう
          </h1>
          <p className="text-sm leading-relaxed text-white/60">
            おふたりの理想の式場を見つける旅のスタートです。
            3問答えるだけで、AIがあなたに合う式場を提案します。
          </p>
          {/* Social proof */}
          <div className="space-y-3 rounded-xl bg-white/5 p-4">
            <p className="text-xs font-medium text-[var(--gold-warm)]">知っていましたか？</p>
            <p className="text-sm text-white/80">
              80%のカップルが初期見積もりより平均<span className="font-medium text-[var(--gold-warm)]">+100万円</span>上がっています。
              Harenohiは、その「想定外」を事前に教えます。
            </p>
          </div>
        </div>
        <p className="text-[10px] text-white/30">
          © 2026 Harenohi
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile header */}
          <div className="text-center lg:hidden">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)]">
              Harenohi
            </p>
            <h2 className="mt-2">式場探し、はじめましょう</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              おふたりの理想の式場を見つける旅のスタートです
            </p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block">
            <h2 className="text-lg">アカウントを作成</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              無料で利用できます。3分で始められます。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">お名前</Label>
              <Input
                id="name"
                type="text"
                placeholder="山田 太郎"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
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
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">または</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: `${window.location.origin}/callback` },
                });
              }}
            >
              Googleで登録
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
