"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Check, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getPushState,
  isPushSupported,
  requestAndSubscribe,
  unsubscribePush,
  type PushState,
} from "@/lib/push/subscription";
import {
  listMySubscriptions,
  type MySubscriptionRow,
} from "@/server/actions/push-subscription";

/**
 * Mypage permission-state strip (Track B-1).
 *
 * Renders one of four UI branches based on the live browser state, refreshed
 * on mount. Sits inside the Notifications card next to the frequency
 * segmented control — the latter governs *when* we send, this one governs
 * *whether the device can receive at all*.
 *
 *   default   → opt-in CTA (delegates to the same requestAndSubscribe path
 *               as the post-visit sheet, so behaviour stays consistent)
 *   granted   → subscribed: status badge + per-device list with revoke
 *               unsubscribed: re-subscribe CTA (browser wiped the SW)
 *   denied    → static help block linking to browser-settings instructions
 *   unsupported → silent (don't clutter the UI on Safari < 16.4 etc.)
 *
 * Why fetch state on mount instead of accepting it as a prop:
 *   - `Notification.permission` lives in the browser, not on the server. A
 *     server-derived prop would always be stale (or worse, "denied" by
 *     default because there's no permission API on Node).
 *   - The user can flip permission in browser settings at any time. Reading
 *     fresh on mount keeps the UI honest after a tab refocus.
 */
interface Props {
  vapidPublicKey: string;
}

export function PushPermissionState({ vapidPublicKey }: Props) {
  const [state, setState] = useState<PushState | null>(null);
  const [devices, setDevices] = useState<MySubscriptionRow[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setState({ supported: false });
      return;
    }
    const next = await getPushState();
    setState(next);
    if (next.supported && next.permission === "granted" && next.subscribed) {
      try {
        const rows = await listMySubscriptions();
        setDevices(rows);
      } catch {
        setDevices([]);
      }
    } else {
      setDevices(null);
    }
  }, []);

  useEffect(() => {
    // Defer through a microtask so the initial `refresh()` setState lands
    // *after* this effect's render cycle, satisfying React 19's
    // `set-state-in-effect` rule. The mount probe fires async anyway —
    // this just shifts it off the synchronous path.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  function handleEnable() {
    startTransition(async () => {
      try {
        const next = await requestAndSubscribe({ vapidPublicKey });
        setState(next);
        if (next.supported && next.permission === "granted" && next.subscribed) {
          toast.success("通知を受け取る設定にしました");
          await refresh();
        } else if (next.supported && next.permission === "denied") {
          toast.message("受け取らないことにします", {
            description: "ブラウザ設定からあとで変更できます",
          });
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message === "notifications-not-supported"
            ? "このブラウザは通知に対応していません"
            : "通知の設定に失敗しました";
        toast.error(message);
      }
    });
  }

  function handleDisable() {
    startTransition(async () => {
      try {
        const next = await unsubscribePush();
        setState(next);
        setDevices(null);
        toast.success("この端末では通知を止めました");
      } catch {
        toast.error("通知の停止に失敗しました");
      }
    });
  }

  // First paint guard — until we've probed the browser, render a thin
  // placeholder so the card height stays stable (avoids layout shift).
  if (state === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        通知の状態を確認しています
      </div>
    );
  }

  // Silent on browsers without push at all — the segmented control above
  // (in-app inbox / email future) still works for them.
  if (!state.supported) return null;

  if (state.permission === "denied") {
    return (
      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span>このブラウザでは通知が止まっています</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          ブラウザの設定から「通知を許可」に切り替えると、もう一度受け取れます。
        </p>
      </div>
    );
  }

  if (state.permission === "default") {
    return (
      <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>見学のリマインダーを受け取る</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          前日朝・当日 1 時間前・見学後の節目に、おふたりへ短いお知らせをお届けします。
        </p>
        <Button
          type="button"
          size="sm"
          onClick={handleEnable}
          disabled={isPending || !vapidPublicKey}
          className="min-h-11 w-full"
        >
          {isPending ? "確認中…" : "受け取る"}
        </Button>
      </div>
    );
  }

  // permission === "granted"
  if (!state.subscribed) {
    return (
      <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>もう一度この端末で受け取る</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          ブラウザのデータが消えたあと、登録がリセットされたようです。
        </p>
        <Button
          type="button"
          size="sm"
          onClick={handleEnable}
          disabled={isPending || !vapidPublicKey}
          className="min-h-11 w-full"
        >
          {isPending ? "確認中…" : "もう一度設定する"}
        </Button>
      </div>
    );
  }

  // granted + subscribed
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2.5 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span className="text-foreground">この端末で受け取れます</span>
      </div>

      {devices && devices.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            登録中の端末
          </p>
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
              >
                <ChevronRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{labelForUserAgent(d.userAgent)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleDisable}
        disabled={isPending}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 self-center text-xs text-muted-foreground hover:text-foreground"
      >
        <BellOff className="h-3 w-3" aria-hidden="true" />
        この端末では受け取らない
      </button>
    </div>
  );
}

/**
 * Friendly device label from a stored User-Agent. We only need a coarse
 * "MacBook (Chrome)" hint for the user to recognise their own devices —
 * a full UA parser would be overkill. Falls back to "この端末" when the
 * UA wasn't captured (older subscriptions persisted before the field
 * existed).
 */
function labelForUserAgent(ua: string | null): string {
  if (!ua) return "この端末";
  const platform = matchPlatform(ua);
  const browser = matchBrowser(ua);
  if (platform && browser) return `${platform}（${browser}）`;
  return platform ?? browser ?? "この端末";
}

function matchPlatform(ua: string): string | null {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function matchBrowser(ua: string): string | null {
  // Order matters: Chrome's UA contains "Safari", so check Edge/Chrome first.
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}
