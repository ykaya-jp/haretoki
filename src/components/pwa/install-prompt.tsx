"use client";

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * App install affordance.
 *
 * Two paths because the platforms expose this very differently:
 *
 * 1. Android Chrome / Edge / desktop Chromium — the browser fires a
 *    `beforeinstallprompt` event we can stash and trigger on demand.
 *    We render a one-tap banner with a primary "インストール" button.
 * 2. iOS Safari — no programmatic prompt. We fall back to a brief
 *    instruction strip that walks the user through Share → ホーム画面
 *    に追加, only when we can prove the page is *not* already running
 *    in standalone mode.
 *
 * Dismissal is per-device (localStorage). A 14-day cool-down keeps the
 * banner from feeling like spam after the user said no once. If the
 * app is already installed (display-mode: standalone or the legacy iOS
 * `navigator.standalone` flag), nothing renders.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_COOLDOWN_DAYS = 14;
// iOS hint should not flash the moment the user lands — let the page
// settle and any onboarding modals open first.
const IOS_HINT_DELAY_MS = 1500;

function isRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const dismissedAt = window.localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return false;
  const daysSince =
    (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
  return Number.isFinite(daysSince) && daysSince < DISMISS_COOLDOWN_DAYS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari < 17 still uses the legacy `navigator.standalone` flag.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIOSSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  // Exclude in-app webviews (Twitter, Slack, etc.) — those can't add to
  // home screen, and showing the hint would be confusing.
  const isWebview =
    /(FBAN|FBAV|Instagram|Line|TwitterAndroid|WhatsApp)/.test(ua);
  return isAppleMobile && !isWebview;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  // Lazy initial state — reads from localStorage / matchMedia at the
  // first client render, returns the SSR-safe `false` on the server.
  // Doing this inside `useEffect` would trip
  // react-hooks/set-state-in-effect for what is really one-time
  // initialisation. See: docs/lessons.md (set-state-in-effect / React 19).
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined" ? false : isRecentlyDismissed(),
  );
  const [standalone] = useState(() =>
    typeof window === "undefined" ? false : isStandalone(),
  );

  useEffect(() => {
    if (standalone || dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    let timer: number | undefined;
    if (isIOSSafari()) {
      timer = window.setTimeout(() => setShowIosHint(true), IOS_HINT_DELAY_MS);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [standalone, dismissed]);

  if (standalone || dismissed) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  if (deferredPrompt) {
    const handleInstall = async () => {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      } else {
        // User cancelled the native prompt — treat as a dismissal so we
        // don't pop it again on the very next page navigation.
        handleDismiss();
      }
    };

    return (
      <div
        role="region"
        aria-label="アプリをインストール"
        className="fixed left-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-modal)]"
        style={{ bottom: "calc(56px + env(safe-area-inset-bottom) + 8px)" }}
      >
        <Download
          className="h-5 w-5 shrink-0 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">アプリとして使う</p>
          <p className="text-xs text-muted-foreground">
            ホーム画面に追加でき、オフラインでも開けます
          </p>
        </div>
        <Button size="sm" onClick={handleInstall}>
          追加する
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="案内を閉じる"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (showIosHint) {
    return (
      <div
        role="region"
        aria-label="ホーム画面に追加する手順"
        className="fixed left-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-modal)]"
        style={{ bottom: "calc(56px + env(safe-area-inset-bottom) + 8px)" }}
      >
        <Share
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">ホーム画面に追加</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Safari 下部の{" "}
            <Share
              className="inline-block h-3 w-3 -translate-y-px"
              strokeWidth={1.8}
              aria-hidden="true"
            />{" "}
            を開いて「ホーム画面に追加」を選ぶと、アプリとして使えます。
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="案内を閉じる"
          className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors active:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
}
