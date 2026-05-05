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
 *    We render a one-tap banner with a primary "アプリにする" button.
 * 2. iOS Safari — no programmatic prompt. We fall back to a brief
 *    instruction strip that walks the user through Share → ホーム画面
 *    に追加, only when we can prove the page is *not* already running
 *    in standalone mode.
 *
 * Surfacing rules (Phase 4 redesign):
 *
 *   - Never on the *first* session. A couple landing on Haretoki for
 *     the first time is mid-onboarding; a banner asking them to also
 *     install the app reads as pushy. The banner debuts on the
 *     **second session** at the earliest — which we approximate via a
 *     session counter in localStorage that increments once per
 *     UTC-day window.
 *   - Or as soon as a high-intent action fires (e.g. the user just
 *     added a venue or accepted a partner invitation). Those paths
 *     call `markPwaEngaged()` to drop a flag the prompt reads on its
 *     next mount; they're a stronger conversion signal than "second
 *     session ever". The next high-intent action surface that wires
 *     this should be the venue-add Server Action — wiring it across
 *     every callsite in this round would create churn-conflict with
 *     parallel workers, so the helper is exported and unused for now.
 *   - Copy adapts to the couple state: a solo user (no partner yet)
 *     gets a "ふたりで" hint that nudges them toward inviting; a
 *     joined couple gets the original utility-first copy. We detect
 *     the joined state via the same `partner_welcome_modal_dismissed`
 *     localStorage flag set by partner-welcome-modal — a partner who
 *     dismissed the welcome screen has, by definition, joined the
 *     project.
 *   - Dismissal is per-device (localStorage). A 14-day cool-down keeps
 *     the banner from feeling like spam after the user said no once.
 *   - If the app is already installed (display-mode: standalone or the
 *     legacy iOS `navigator.standalone` flag), nothing renders.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_COOLDOWN_DAYS = 14;
const SESSION_COUNT_KEY = "pwa-session-count";
const SESSION_LAST_AT_KEY = "pwa-session-last-at";
const ENGAGED_KEY = "pwa-install-engaged-at";
// 6h between session "ticks". Matches the editorial cadence the daily
// ritual expects ("1日1回開く"); a couple coming back the same evening
// to add another venue still counts as the same session, but a return
// the next morning legitimately ticks the counter.
const SESSION_WINDOW_MS = 6 * 60 * 60 * 1000;
const PARTNER_JOINED_KEY = "partner_welcome_modal_dismissed";
// iOS hint should not flash the moment the user lands — let the page
// settle and any onboarding modals open first.
const IOS_HINT_DELAY_MS = 1500;

/**
 * Drop a high-intent flag so the install prompt can surface eagerly
 * on its next mount, even if the user is still inside their first
 * session. Call from venue-add / partner-accept / decision-saved
 * server-action client effects.
 *
 * Idempotent — overwrites the timestamp so repeated calls in a row
 * don't multiply the signal. The prompt clears this key after it
 * surfaces so the same engagement only buys one banner appearance.
 */
export function markPwaEngaged(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ENGAGED_KEY, String(Date.now()));
  } catch {
    // Private browsing / quota — degrade silently.
  }
}

function readEngagedAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ENGAGED_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function clearEngaged(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ENGAGED_KEY);
  } catch {
    // ignore
  }
}

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

/**
 * Tick the session counter at most once per `SESSION_WINDOW_MS`.
 * Returns the *new* count after the tick (or the existing count if
 * we're inside the same session window). Quota / private-mode errors
 * fall through to a 1-counted "first session" so the prompt never
 * surfaces spuriously when localStorage is unavailable.
 */
function tickSessionCounter(): number {
  if (typeof window === "undefined") return 1;
  try {
    const lastRaw = window.localStorage.getItem(SESSION_LAST_AT_KEY);
    const countRaw = window.localStorage.getItem(SESSION_COUNT_KEY);
    const lastAt = lastRaw ? Number(lastRaw) : 0;
    const count = countRaw ? Number(countRaw) : 0;
    const now = Date.now();
    if (
      Number.isFinite(lastAt) &&
      lastAt > 0 &&
      now - lastAt < SESSION_WINDOW_MS
    ) {
      // Inside the same session window — don't double-count.
      return Number.isFinite(count) ? count : 1;
    }
    const next = (Number.isFinite(count) ? count : 0) + 1;
    window.localStorage.setItem(SESSION_COUNT_KEY, String(next));
    window.localStorage.setItem(SESSION_LAST_AT_KEY, String(now));
    return next;
  } catch {
    return 1;
  }
}

function partnerHasJoined(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PARTNER_JOINED_KEY) === "1";
  } catch {
    return false;
  }
}

interface PromptCopy {
  title: string;
  body: string;
  cta: string;
}

function copyForState(coupled: boolean): PromptCopy {
  if (coupled) {
    return {
      title: "アプリにすると、ふたりがもっと近く",
      body: "ホーム画面から開けて、通知も受け取れます",
      cta: "追加する",
    };
  }
  return {
    title: "アプリとして使う",
    body: "ホーム画面に追加でき、オフラインでも開けます",
    cta: "追加する",
  };
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
  // Session counter ticks on first mount. Reading via initializer means
  // a single tick per page-load — extra rerenders inside the same mount
  // do not re-increment. The "engaged" signal is read alongside so
  // both gates collapse into one boolean below.
  const [shouldSurface] = useState(() => {
    if (typeof window === "undefined") return false;
    const sessions = tickSessionCounter();
    const engagedAt = readEngagedAt();
    const recentlyEngaged =
      engagedAt !== null && Date.now() - engagedAt < 7 * 24 * 60 * 60 * 1000;
    if (recentlyEngaged) {
      // Engagement consumed — clear so we don't keep surfacing on every
      // subsequent navigation until the cooldown lapses.
      clearEngaged();
      return true;
    }
    // Default: surface on the second session and beyond.
    return sessions >= 2;
  });
  const [coupled] = useState(() =>
    typeof window === "undefined" ? false : partnerHasJoined(),
  );

  useEffect(() => {
    if (standalone || dismissed || !shouldSurface) return;

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
  }, [standalone, dismissed, shouldSurface]);

  if (standalone || dismissed || !shouldSurface) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const copy = copyForState(coupled);

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
        className="fixed z-50 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-modal)]"
        style={{
          bottom: "calc(56px + env(safe-area-inset-bottom) + 8px)",
          left: "max(1rem, env(safe-area-inset-left))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <Download
          className="h-5 w-5 shrink-0 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{copy.title}</p>
          <p className="text-xs text-muted-foreground">{copy.body}</p>
        </div>
        <Button size="sm" onClick={handleInstall}>
          {copy.cta}
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
        className="fixed z-50 flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-modal)]"
        style={{
          bottom: "calc(56px + env(safe-area-inset-bottom) + 8px)",
          left: "max(1rem, env(safe-area-inset-left))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <Share
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {coupled ? "ふたりのホーム画面に追加" : "ホーム画面に追加"}
          </p>
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
