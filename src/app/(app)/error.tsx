"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, WifiOff } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Initialize from navigator lazily. This is a client component, so useState's
  // initializer runs on the client and avoids hydration mismatch (this page is
  // only rendered after an error, never statically).
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" && "onLine" in navigator
      ? !navigator.onLine
      : false,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)]">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          {offline ? (
            <WifiOff className="h-12 w-12 text-destructive" />
          ) : (
            <AlertCircle className="h-12 w-12 text-destructive" />
          )}
          <div>
            <h2 className="text-lg">
              {offline ? "オフラインです" : "うまくいきませんでした"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {offline
                ? "ネットワーク接続を確認してから、もう一度お試しください"
                : "ご不便をおかけして申し訳ありません。もう一度お試しください"}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={reset} className="w-full">
              もう一度試す
            </Button>
            <Button variant="outline" render={<Link href="/home" />} className="w-full">
              ホームに戻る
            </Button>
            <a
              href="mailto:support@haretoki.app"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              お問い合わせ
            </a>
          </div>
          {error.digest && (
            <p className="mt-1 text-[10px] tabular-nums text-muted-foreground/70">
              エラーID: {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
