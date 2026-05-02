/**
 * Web Push subscription client helper (Track B-1).
 *
 * Wraps the browser's `Notification.permission` + `serviceWorker` +
 * `pushManager.subscribe()` flow into a small typed API the React
 * component can reason about without re-implementing the spec.
 *
 * SSR-safe: every function checks `typeof window` / capability before
 * touching the DOM API. Calling these from a Server Component is a
 * no-op (returns the default unsupported state), so the same module
 * can be imported by code that runs in both contexts.
 */

import {
  saveSubscription,
  removeSubscription,
} from "@/server/actions/push-subscription";

/**
 * Computed capability + state. Returned by `getPushState()` so the
 * settings UI can switch on a single value instead of probing the
 * browser API itself.
 */
export type PushState =
  /** This browser doesn't support Web Push at all (Safari before 16.4 etc.). */
  | { supported: false }
  /** Supported but the user hasn't decided yet — show opt-in CTA. */
  | { supported: true; permission: "default"; subscribed: false }
  /** User said yes — show "subscribed" UI + per-timing toggles. */
  | { supported: true; permission: "granted"; subscribed: true }
  /** Granted but no live subscription — usually after browser data
   *  wipe / extension blocked the SW. Show "re-subscribe" CTA. */
  | { supported: true; permission: "granted"; subscribed: false }
  /** User explicitly blocked — only OS / browser-settings can flip
   *  back; we show a help link. */
  | { supported: true; permission: "denied"; subscribed: false };

/**
 * VAPID public key as a Uint8Array suitable for `subscribe({
 * applicationServerKey })`. The browser refuses raw base64 strings,
 * so we transform to bytes here.
 *
 * Exported so tests can verify the conversion against a fixture.
 */
export function vapidKeyFromBase64Url(
  base64Url: string,
): Uint8Array<ArrayBuffer> {
  // base64url → base64 (replace -+/, pad to multiple of 4).
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Allocate the backing ArrayBuffer explicitly so the resulting
  // Uint8Array narrows to `Uint8Array<ArrayBuffer>` instead of the wider
  // `Uint8Array<ArrayBufferLike>`. PushManager.subscribe's
  // `applicationServerKey` parameter rejects the wider type under
  // TypeScript 5.7+'s SharedArrayBuffer-aware lib types.
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Probe whether Web Push is supported in this browser. The 3 APIs
 * we need:
 *   1. `serviceWorker` (registration)
 *   2. `PushManager` (subscription)
 *   3. `Notification` (permission state)
 * If any are missing the browser can't deliver a push, full stop.
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Read the current state in a single call so the settings UI doesn't
 * have to interleave 3 different API probes.
 */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return { supported: false };

  const permission = Notification.permission;
  if (permission === "denied") {
    return { supported: true, permission: "denied", subscribed: false };
  }

  // For default + granted we still need to know if there's a live
  // subscription. `getSubscription()` returns null when the SW exists
  // but the browser has no record (post-data-wipe etc.).
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    subscribed = sub !== null;
  } catch {
    // SW not registered yet / browser refused — treat as not subscribed.
  }

  if (permission === "default") {
    return { supported: true, permission: "default", subscribed: false };
  }
  return {
    supported: true,
    permission: "granted",
    subscribed,
  };
}

/**
 * Register the service worker if it isn't already. Idempotent — calling
 * twice in the same session reuses the existing registration. The SW
 * lives at `/sw.js` (round 5 PWA infra).
 */
async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker is not supported in this browser");
  }
  // If the user already has a registration we reuse it. `register()` is
  // idempotent — same scope returns the same SW — but `ready` is faster.
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/**
 * Full opt-in: prompt for permission → subscribe → POST to server.
 *
 * Called from the permission sheet's "yes" button. Returns the new
 * state so the caller can update its UI in one round-trip; throws on
 * unrecoverable error (caller shows a toast).
 *
 * The browser's permission prompt MUST be tied to a user gesture —
 * call this from inside an `onClick` handler, never from `useEffect`.
 */
export async function requestAndSubscribe(opts: {
  vapidPublicKey: string;
}): Promise<PushState> {
  if (!isPushSupported()) {
    throw new Error("notifications-not-supported");
  }
  if (!opts.vapidPublicKey) {
    throw new Error("VAPID_PUBLIC_KEY is missing");
  }

  // 1. Permission. `requestPermission()` returns the resolved state;
  // when the user clicked "deny" we surface that here so the caller
  // doesn't have to re-probe.
  const permission =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permission !== "granted") {
    return getPushState();
  }

  // 2. SW + subscribe.
  const reg = await ensureServiceWorker();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyFromBase64Url(opts.vapidPublicKey),
    });
  }

  // 3. Persist server-side. Best-effort — if the network is flaky we
  // still return granted/subscribed (the browser holds the truth) and
  // a future visit can retry the persist.
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (endpoint && p256dh && auth) {
    await saveSubscription({
      endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent.slice(0, 256),
    }).catch(() => {
      // Non-fatal; user-visible push still works on the device that
      // already cached the subscription. Server backfill happens on
      // next visit when the page re-runs `ensureSubscriptionPersisted()`.
    });
  }

  return getPushState();
}

/**
 * Reverse: unsubscribe locally + tell the server to drop the row.
 * Used by the settings UI's "受け取らない" button. Idempotent.
 */
export async function unsubscribePush(): Promise<PushState> {
  if (!isPushSupported()) return { supported: false };

  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        // Clean up server side too. removeSubscription is auth-scoped
        // and tolerates "already gone" (count=0).
        await removeSubscription({ endpoint }).catch(() => {});
      }
    }
  } catch {
    // Swallow — caller still receives the recomputed state.
  }
  return getPushState();
}

/**
 * Backfill: if the browser already has a subscription but our server
 * never saw it (network flake during initial subscribe, fresh DB after
 * a clear-and-restore, etc.), persist it now. Safe to call on every
 * page load — it's a no-op when already in sync.
 */
export async function ensureSubscriptionPersisted(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return;
    await saveSubscription({
      endpoint,
      keys: { p256dh, auth },
      userAgent: navigator.userAgent.slice(0, 256),
    }).catch(() => {});
  } catch {
    // Best-effort.
  }
}
