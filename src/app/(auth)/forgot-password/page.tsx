"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * /forgot-password — sends a password reset email.
 *
 * UX intent:
 *   - Always show "送信しました" success state regardless of whether the
 *     email exists in our user table (enumeration mitigation: an
 *     attacker probing emails should not be able to confirm membership
 *     via this surface).
 *   - Reset link lands at /reset-password (handled by Supabase magic
 *     link → next.js callback → /reset-password page that captures the
 *     password update form).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/reset-password`
        : "/reset-password";

    // Fire and forget — never expose whether the email exists.
    await supabase.auth
      .resetPasswordForEmail(email, { redirectTo })
      .catch(() => {
        // Silent — don't leak the failure mode to enumerate users
      });

    setLoading(false);
    setSubmitted(true);
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
            パスワードを再設定
          </h1>
          <p className="text-fluid-sm leading-relaxed text-muted-foreground">
            登録メールアドレスを入力してください。再設定用のリンクをお送りします。
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-baseline gap-2">
              <MailCheck
                className="h-4 w-4 text-[var(--gold-warm)]"
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <p className="text-eyebrow text-[var(--gold-warm)]">送信しました</p>
            </div>
            <p className="text-fluid-sm leading-relaxed text-foreground/85">
              入力されたメールアドレス宛に再設定リンクを送信しました。
              メールが届かない場合は、迷惑メールフォルダもご確認ください。
            </p>
            <Link
              href="/login"
              prefetch={true}
              className="inline-flex min-h-11 items-center text-fluid-sm text-[var(--gold-warm)] underline-offset-2 hover:underline"
            >
              ログイン画面へ戻る →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2.5">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="ふたりのメールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  送信中…
                </>
              ) : (
                "再設定リンクを送る"
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
        )}
      </div>
    </div>
  );
}
