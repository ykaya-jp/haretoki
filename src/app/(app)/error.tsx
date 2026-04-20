"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CloudSun } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Referrer-aware back button — lazy initializers read browser state once on mount
  const [prevHref] = useState<string | null>(() => {
    if (typeof document === "undefined" || !document.referrer) return null;
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) return ref.pathname;
    } catch {
      // Invalid referrer URL
    }
    return null;
  });

  const [prevLabel] = useState<string>(() => {
    if (typeof document === "undefined" || !document.referrer) return "戻る";
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin) {
        const segments = ref.pathname.split("/").filter(Boolean);
        if (segments.length === 0) return "ホームへ戻る";
        const last = segments[segments.length - 1];
        const labelMap: Record<string, string> = {
          home: "ホームへ戻る",
          venues: "式場一覧へ戻る",
          shortlist: "候補リストへ戻る",
          coach: "AIコーチへ戻る",
          mypage: "マイページへ戻る",
        };
        return labelMap[last] ?? "前のページへ戻る";
      }
    } catch {
      // Invalid referrer URL
    }
    return "戻る";
  });

  useEffect(() => {
    console.error(error);
  }, [error]);

  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-soft)] overflow-hidden">
        <CardContent className="flex flex-col items-center gap-5 p-6 text-center">
          {/* Gold radial gradient background ring */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklab, var(--gold-warm) 18%, transparent) 0%, transparent 70%)",
                width: "80px",
                height: "80px",
                transform: "translate(-50%, -50%)",
                left: "50%",
                top: "50%",
              }}
            />
            <CloudSun
              className="relative h-12 w-12"
              style={{ color: "var(--gold-warm)" }}
              strokeWidth={1.4}
            />
          </div>

          <div>
            <h2
              className="font-light tracking-[-0.01em]"
              style={{
                fontFamily:
                  'var(--font-display, "Shippori Mincho", "Noto Serif JP", serif)',
                fontSize: "22px",
                fontWeight: 300,
              }}
            >
              ちょっとひと息つきましょう
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              こちらの読み込みにつまずきました。
              <br />
              もう一度ためすと、開くことがあります。
            </p>
          </div>

          {/* Retry */}
          <Button
            className="w-full"
            onClick={handleRetry}
            disabled={isPending}
          >
            {isPending ? "読み込み中…" : "もう一度ひらく"}
          </Button>

          {/* Referrer-aware back button */}
          {prevHref ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(prevHref)}
            >
              {prevLabel}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push("/home")}
            >
              ホームへ戻る
            </Button>
          )}

          {/* Support link */}
          <a
            href="mailto:support@haretoki.app"
            className="text-[13px] underline underline-offset-[3px]"
            style={{ color: "var(--gold-warm)" }}
          >
            それでも直らないときは、わたしたちへ
          </a>

          {/* Error digest */}
          {error.digest && (
            <p className="text-[10px] text-muted-foreground tabular-nums opacity-60">
              ID {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
