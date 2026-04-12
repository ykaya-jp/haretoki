"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
        options: {
          data: { name },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("このメールアドレスは既に登録されています");
        } else {
          setError("登録中にエラーが発生しました。もう一度お試しください");
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("登録中にエラーが発生しました。もう一度お試しください");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-soft)]">
        <CardHeader className="text-center">
          <h1 className="font-serif text-2xl text-primary">VenueLens</h1>
          <p className="text-sm text-muted-foreground">
            式場探し、はじめましょう
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            おふたりの理想の式場を見つける旅のスタートです
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
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
                placeholder="example@email.com"
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
                placeholder="6文字以上のパスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "準備中..." : "はじめる"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-primary underline">
              ログイン
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
