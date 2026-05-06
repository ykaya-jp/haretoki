"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * /reset-password — landing page from the password-reset email.
 *
 * Supabase magic link drops the user here with a recovery session
 * already attached (the `?code=` is exchanged by the supabase client
 * on hydration). User submits a new password → updateUser → redirect
 * to /home.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Verify the recovery session was established (Supabase exchanges the
  // ?code= URL param into a recovery session on hydration).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        setError(
          "再設定セッションが見つかりません。メールのリンクをもう一度開いてください。",
        );
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。もう一度ご確認ください。");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは 8 文字以上で設定してください。");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(
          "パスワードの更新がうまくいきませんでした。もう一度お試しください。",
        );
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError("通信エラーが起きました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 font-[family-name:var(--font-display)] text-fluid-base font-light text-foreground"
          >
            <span className="text-[var(--gold-warm)]">Haretoki</span>
          </Link>
          <h1 className="font-[family-name:var(--font-display)] text-fluid-3xl font-light leading-[1.18] tracking-[-0.01em]">
            新しいパスワード
          </h1>
          <p className="text-fluid-sm leading-relaxed text-muted-foreground">
            これからお使いになる新しいパスワードを設定してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="password">新しいパスワード</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8 文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="confirm-password">確認のため再度入力</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="同じパスワードを入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="flex items-baseline gap-2 text-fluid-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !sessionReady}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                更新中…
              </>
            ) : (
              <>
                <ShieldCheck
                  className="mr-2 h-4 w-4"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                パスワードを更新
              </>
            )}
          </Button>

          <p className="text-center text-fluid-xs text-muted-foreground">
            <Link
              href="/login"
              prefetch={true}
              className="text-[var(--gold-warm)] underline-offset-2 hover:underline"
            >
              ログイン画面へ戻る
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
