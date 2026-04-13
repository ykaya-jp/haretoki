"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
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
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      router.push("/home");
      router.refresh();
    } catch {
      setError("ログイン中にエラーが発生しました。もう一度お試しください");
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
            VenueLens
          </p>
        </div>
        <div className="max-w-md">
          <h1 className="font-serif text-3xl font-light leading-snug tracking-[0.04em] text-white">
            おかえりなさい
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            式場探しの続きを始めましょう。AIコーチがあなたの進捗を覚えています。
          </p>
        </div>
        <p className="text-[10px] text-white/30">
          © 2026 VenueLens
        </p>
      </div>

      {/* Right: Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="text-center lg:hidden">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)]">
              VenueLens
            </p>
            <h2 className="mt-2">ログイン</h2>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block">
            <h2 className="text-lg">ログイン</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              メールアドレスとパスワードを入力してください
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

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
              Googleでログイン
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="font-medium text-primary underline underline-offset-4">
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
