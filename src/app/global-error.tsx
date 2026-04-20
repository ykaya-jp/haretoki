"use client";

import { useEffect, useState, useTransition } from "react";

// Inline styles only — layout.tsx CSS variables are unavailable in global-error boundary.
// Hex values approximate the Haretoki "Morning Light" design tokens.
const COLOR = {
  bg: "#F8F4EE",        // --background oklch(0.97 0.01 80)
  fg: "#3B3229",        // --foreground oklch(0.22 0.02 50)
  primary: "#C27366",   // --primary oklch(0.62 0.12 45)
  gold: "#C9A45A",      // --gold-warm oklch(0.70 0.13 80)
  muted: "#6E6056",     // --muted-foreground oklch(0.45 0.02 60)
  border: "#E5DDD5",    // --border oklch(0.91 0.02 70)
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof navigator !== "undefined" && "onLine" in navigator) {
      return !navigator.onLine;
    }
    return false;
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    // Capture error in Sentry if available
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sentry = (globalThis as any).__SENTRY__;
      if (sentry?.captureException) {
        sentry.captureException(error);
      }
    } catch {
      // Sentry not available
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [error]);

  function handleRetry() {
    startTransition(() => {
      reset();
    });
    // Fallback: if reset() re-throws immediately, reload after 80ms
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }, 80);
  }

  const heading = isOffline
    ? "少し、雲がかかっています"
    : "ちょっとひと息つきましょう";

  const body = isOffline
    ? "電波が届くところで、もう一度ひらいてみてください。"
    : "こちらの読み込みにつまずきました。もう一度ためすと、開くことがあります。";

  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          fontFamily:
            '"Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          // Dawn gradient: cream base + top-left rose tint + bottom-right gold tint
          background: [
            `radial-gradient(ellipse 80% 50% at 20% 0%, rgba(234,213,207,0.25) 0%, rgba(248,244,238,0) 70%)`,
            `radial-gradient(ellipse 70% 50% at 80% 100%, rgba(212,184,122,0.18) 0%, rgba(248,244,238,0) 70%)`,
            COLOR.bg,
          ].join(", "),
          color: COLOR.fg,
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "22rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
            textAlign: "center",
          }}
        >
          {/* Sun-through-clouds SVG icon */}
          <svg
            width="72"
            height="72"
            viewBox="0 0 72 72"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#E8B96A" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#D4976A" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#C27366" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Sun glow */}
            <circle cx="36" cy="28" r="22" fill="url(#sunGrad)" />
            {/* Sun core */}
            <circle cx="36" cy="28" r="11" fill="#E8B96A" opacity="0.85" />
            {/* Light rays */}
            <line x1="36" y1="6" x2="36" y2="2" stroke="#E8B96A" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="52" y1="12" x2="55" y2="9" stroke="#E8B96A" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="58" y1="28" x2="62" y2="28" stroke="#E8B96A" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="20" y1="12" x2="17" y2="9" stroke="#E8B96A" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            <line x1="14" y1="28" x2="10" y2="28" stroke="#E8B96A" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
            {/* Cloud */}
            <rect x="10" y="44" width="52" height="20" rx="10" fill="#F8F4EE" />
            <circle cx="26" cy="44" r="12" fill="#EDE6DC" />
            <circle cx="40" cy="41" r="15" fill="#EDE6DC" />
            <circle cx="54" cy="46" r="10" fill="#EDE6DC" />
            <rect x="14" y="46" width="44" height="16" rx="8" fill="#EDE6DC" />
          </svg>

          {/* Heading — Shippori Mincho / Noto Serif JP */}
          <h1
            style={{
              margin: 0,
              fontFamily:
                '"Shippori Mincho", "Noto Serif JP", Georgia, serif',
              fontSize: "24px",
              fontWeight: 300,
              letterSpacing: "-0.01em",
              lineHeight: 1.4,
              color: COLOR.fg,
            }}
          >
            {heading}
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: 1.7,
              color: COLOR.muted,
            }}
          >
            {body}
          </p>

          {/* Retry button */}
          <button
            onClick={handleRetry}
            disabled={isPending}
            style={{
              width: "100%",
              minHeight: "2.75rem",
              padding: "0 20px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: isPending
                ? `${COLOR.primary}99`
                : COLOR.primary,
              color: "#FFFFFF",
              fontSize: "15px",
              fontWeight: 400,
              cursor: isPending ? "default" : "pointer",
              transition: "opacity 0.15s",
              fontFamily: "inherit",
            }}
          >
            {isPending ? "読み込み中…" : "もう一度ひらく"}
          </button>

          {/* Home button */}
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.assign("/home");
              }
            }}
            style={{
              width: "100%",
              minHeight: "2.75rem",
              padding: "0 20px",
              borderRadius: "8px",
              border: `1.5px solid ${COLOR.border}`,
              backgroundColor: "transparent",
              color: COLOR.fg,
              fontSize: "15px",
              fontWeight: 400,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ホームへ戻る
          </button>

          {/* Support link */}
          <a
            href="mailto:support@haretoki.app"
            style={{
              fontSize: "13px",
              color: COLOR.gold,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
              fontFamily: "inherit",
            }}
          >
            それでも直らないときは、わたしたちへ
          </a>

          {/* Error digest */}
          {error.digest && (
            <p
              style={{
                fontSize: "10px",
                color: COLOR.muted,
                fontVariantNumeric: "tabular-nums",
                margin: 0,
                opacity: 0.6,
              }}
            >
              ID {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
