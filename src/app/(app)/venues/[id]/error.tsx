"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, WifiOff } from "lucide-react";

// Segment-level error boundary for the venue detail route. Scoped so a
// data-fetch failure here recovers without unmounting the whole (app) shell
// (bottom nav, providers, toaster all stay alive).
export default function VenueDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" && "onLine" in navigator
      ? !navigator.onLine
      : false,
  );

  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  // Refer back to the couple's previous in-app screen when we can read
  // it from document.referrer (same-origin only). Stops the boundary
  // from always dumping everyone on /candidates — a frustrating jump
  // for someone who tapped a venue from /explore or /home. Lazy useState
  // instead of useMemo so React Compiler can preserve it.
  const [{ prevHref, prevLabel }] = useState<{
    prevHref: string;
    prevLabel: string;
  }>(() => {
    if (typeof document === "undefined") {
      return { prevHref: "/home", prevLabel: "ホームに戻る" };
    }
    const referrer = document.referrer;
    if (!referrer) return { prevHref: "/home", prevLabel: "ホームに戻る" };
    try {
      const url = new URL(referrer);
      if (url.origin !== window.location.origin) {
        return { prevHref: "/home", prevLabel: "ホームに戻る" };
      }
      const path = url.pathname;
      if (path === "/home" || path.startsWith("/home/")) {
        return { prevHref: "/home", prevLabel: "ホームに戻る" };
      }
      if (path === "/explore" || path.startsWith("/explore/")) {
        return { prevHref: "/explore", prevLabel: "探す画面に戻る" };
      }
      if (path === "/candidates" || path.startsWith("/candidates/")) {
        return { prevHref: "/candidates", prevLabel: "候補に戻る" };
      }
      if (path === "/coach" || path.startsWith("/coach/")) {
        return { prevHref: "/coach", prevLabel: "コーチに戻る" };
      }
      // Unknown internal path — use the raw path, labelled generically.
      return { prevHref: path, prevLabel: "さっきの画面に戻る" };
    } catch {
      return { prevHref: "/home", prevLabel: "ホームに戻る" };
    }
  });

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
              {offline
                ? "オフラインです"
                : "式場情報を読み込めませんでした"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {offline
                ? "ネットワーク接続を確認してから、もう一度お試しください"
                : "時間をおいてもう一度お試しください"}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button onClick={reset} className="w-full">
              もう一度試す
            </Button>
            <Button
              variant="outline"
              render={<Link href={prevHref} prefetch={true} />}
              className="w-full"
            >
              {prevLabel}
            </Button>
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
