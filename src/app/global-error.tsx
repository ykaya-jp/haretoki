"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";

// Root-level fallback that replaces <html>/<body>. Since Next re-mounts the
// entire document tree here, we cannot rely on the theme class injected by
// layout.tsx — hence inline style hex values that match the design tokens
// defined in globals.css (`--background: oklch(0.97 0.01 85)` ≈ #FAF6EE,
// `--foreground: oklch(0.22 0.02 50)` ≈ #3B3229, `--primary: oklch(0.62 0.12 25)`
// ≈ #C27366). Keep this in sync with globals.css on any palette change.
const BRAND = {
  bg: "#FAF6EE",
  fg: "#3B3229",
  muted: "#7A6E62",
  primary: "#C27366",
  primaryFg: "#FFFFFF",
  subtle: "#EADFC8",
};

export default function GlobalError({
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
    // Report to Sentry (no-op when DSN unset) AND keep console.error so local
    // dev still surfaces the full stack trace in the browser devtools.
    Sentry.captureException(error);
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
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          backgroundColor: BRAND.bg,
          color: BRAND.fg,
          fontFamily:
            '"Noto Sans JP", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", system-ui, sans-serif',
          fontWeight: 400,
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={{ width: "100%", maxWidth: "28rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 300, margin: 0 }}>
            {offline ? "オフラインです" : "予期しないエラーが発生しました"}
          </h2>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: BRAND.muted,
            }}
          >
            {offline
              ? "ネットワーク接続を確認してください"
              : "ページを再読み込みしてください"}
          </p>
          <div
            style={{
              marginTop: "1rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <button
              onClick={reset}
              style={{
                minHeight: "2.75rem",
                padding: "0.625rem 1.25rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: BRAND.primary,
                color: BRAND.primaryFg,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              再読み込み
            </button>
            <a
              href="/home"
              style={{
                fontSize: "0.875rem",
                color: BRAND.fg,
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              ホームに戻る
            </a>
            <a
              href="mailto:support@haretoki.app"
              style={{
                fontSize: "0.75rem",
                color: BRAND.muted,
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              お問い合わせ
            </a>
          </div>
          {error.digest && (
            <p
              style={{
                marginTop: "0.75rem",
                fontSize: "0.625rem",
                fontVariantNumeric: "tabular-nums",
                color: BRAND.subtle,
              }}
            >
              エラーID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
