/**
 * Server-side Web Push send helper (Track B-2).
 *
 * Wraps the `web-push` library's `sendNotification` so cron handlers
 * don't have to know about VAPID setup, payload encryption, or the
 * dead-endpoint cleanup protocol.
 *
 * VAPID identity reads from env at module load (one shot — the keys
 * don't change per request). Missing env disables the helper: every
 * call resolves to a per-endpoint "skipped" result instead of throwing,
 * so a preview deploy without VAPID still serves the rest of the cron
 * cleanly. Missing VAPID is an operator misconfig, not an end-user bug,
 * so we surface it via Sentry once at first call.
 *
 * Failure protocol (per W3C Push API + RFC 8030):
 *   - 404 / 410 from the push provider = the user's browser-side
 *     subscription is dead (browser data wiped, OS-level block, app
 *     uninstall on Android). The endpoint will never come back; we MUST
 *     drop the row or every future cron will leak a network call.
 *   - 5xx / 429 = transient. Don't drop the row, log a warning, let the
 *     next cron retry naturally.
 *   - other 4xx = malformed payload — bug in our code, capture as error.
 */

import webpush, { type SendResult, type WebPushError } from "web-push";
import { prisma } from "@/server/db";
import { captureError, captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";

let vapidConfigured = false;
let vapidConfigError: string | null = null;

/**
 * One-shot env probe + library setup. Called lazily on the first send so
 * this module is import-safe in build / SSR contexts that have no VAPID
 * env (test, preview without secrets).
 */
function ensureVapid(): { ok: true } | { ok: false; reason: string } {
  if (vapidConfigured) return { ok: true };
  if (vapidConfigError) return { ok: false, reason: vapidConfigError };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:support@haretoki.app";
  if (!publicKey || !privateKey) {
    vapidConfigError = "VAPID env not configured";
    return { ok: false, reason: vapidConfigError };
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return { ok: true };
  } catch (err) {
    vapidConfigError =
      err instanceof Error ? err.message : "setVapidDetails threw";
    captureError(err, {
      component: "push.send",
      alertRoute: "p2-email",
      extra: { action: "push:vapid-setup" },
    });
    return { ok: false, reason: vapidConfigError };
  }
}

/**
 * Test-only escape hatch. The lazy VAPID setup latches its result for the
 * lifetime of the module instance — vitest tests that swap env between
 * specs need a way to force re-evaluation. Production callers should never
 * touch this.
 */
export function __resetVapidStateForTests(): void {
  vapidConfigured = false;
  vapidConfigError = null;
}

/** Push payload contract — `public/sw.js` reads `{title, body, url?, tag?}`. */
export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link target. SW opens this on notification click. */
  url?: string;
  /**
   * OS-side dedupe identifier. Two notifications with the same `tag`
   * collapse to one (the latest replaces the earlier in the OS tray).
   * Use `visit-reminder:<visitId>:<phase>` so a re-fired same-phase
   * reminder updates in place instead of stacking.
   */
  tag?: string;
}

export type SendOutcome =
  | { ok: true; statusCode: number; endpoint: string }
  | { ok: false; reason: "vapid-missing" }
  | {
      ok: false;
      reason: "gone";
      endpoint: string;
      statusCode: number;
      removed: boolean;
    }
  | {
      ok: false;
      reason: "transient";
      endpoint: string;
      statusCode: number;
    }
  | {
      ok: false;
      reason: "fatal";
      endpoint: string;
      statusCode: number | null;
      message: string;
    };

interface RawSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send to a single subscription. Pure helper used by `sendPushToUser`
 * (which does the user → subscriptions fan-out + cleanup). Exported for
 * tests + the future B-3 "test push" button in settings.
 */
export async function sendOneSubscription(
  sub: RawSubscription,
  payload: PushPayload,
): Promise<SendOutcome> {
  const setup = ensureVapid();
  if (!setup.ok) return { ok: false, reason: "vapid-missing" };

  try {
    const result: SendResult = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      // TTL: how long the push provider should buffer if the device is
      // offline. 1h matches the user-perceptible relevance window for our
      // reminders — a 24h-buffered "明日見学" arriving 30h late is noise.
      { TTL: 60 * 60 },
    );
    return {
      ok: true,
      statusCode: result.statusCode,
      endpoint: sub.endpoint,
    };
  } catch (err) {
    return classifyError(err, sub.endpoint);
  }
}

function classifyError(err: unknown, endpoint: string): SendOutcome {
  // web-push throws WebPushError with statusCode for HTTP-shaped failures.
  if (
    err &&
    typeof err === "object" &&
    "statusCode" in err &&
    typeof (err as WebPushError).statusCode === "number"
  ) {
    const status = (err as WebPushError).statusCode;
    if (status === 404 || status === 410) {
      return {
        ok: false,
        reason: "gone",
        endpoint,
        statusCode: status,
        removed: false,
      };
    }
    if (status === 429 || (status >= 500 && status < 600)) {
      return { ok: false, reason: "transient", endpoint, statusCode: status };
    }
    return {
      ok: false,
      reason: "fatal",
      endpoint,
      statusCode: status,
      message: (err as WebPushError).body ?? "fatal push error",
    };
  }
  return {
    ok: false,
    reason: "fatal",
    endpoint,
    statusCode: null,
    message: err instanceof Error ? err.message : "non-Error thrown",
  };
}

export interface SendPushToUserResult {
  attempted: number;
  succeeded: number;
  /** Endpoints removed because the provider returned 404 / 410. */
  pruned: number;
  /** Endpoints that hit a 5xx / 429; left in place for the next tick. */
  transient: number;
  /** Subscriptions that hit a non-recoverable error; reported to Sentry. */
  fatal: number;
}

/**
 * Fan out a single payload to every PushSubscription row owned by
 * `userId`. Drops dead endpoints inline. Returns counters so the caller
 * can roll them into per-cron telemetry. Never throws — every per-row
 * failure is classified + recorded.
 *
 * Design note: we prune 404/410 immediately rather than batching the
 * deletes at end-of-cron. Inline cleanup keeps the row count honest for
 * the *next* invocation in the same tick (e.g. way_home + day_before
 * sharing data) and matches the W3C recommendation of "remove on first
 * permanent error".
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<SendPushToUserResult> {
  const subs = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const out: SendPushToUserResult = {
    attempted: subs.length,
    succeeded: 0,
    pruned: 0,
    transient: 0,
    fatal: 0,
  };
  if (subs.length === 0) return out;

  for (const sub of subs) {
    const result = await sendOneSubscription(sub, payload);
    if (result.ok) {
      out.succeeded++;
      continue;
    }
    if (result.reason === "vapid-missing") {
      // Operator misconfig — log once and stop trying for this user.
      logEvent({
        event: "push_send_skipped",
        fields: { userId, reason: "vapid-missing" },
      });
      out.fatal++;
      break;
    }
    if (result.reason === "gone") {
      // Drop the dead row so the next cron doesn't waste another HTTP
      // call against it. Best-effort — failure to delete just means we
      // try again next tick (idempotent).
      const deleted = await prisma.pushSubscription
        .deleteMany({ where: { id: sub.id } })
        .then((r) => r.count > 0)
        .catch(() => false);
      if (deleted) out.pruned++;
      continue;
    }
    if (result.reason === "transient") {
      out.transient++;
      captureMessage("[push.send] transient push failure", {
        level: "warning",
        component: "push.send",
        alertRoute: "p3-digest",
        extra: {
          userId,
          endpoint: result.endpoint,
          statusCode: result.statusCode,
        },
      });
      continue;
    }
    // fatal
    out.fatal++;
    captureError(new Error(`push.send fatal: ${result.message}`), {
      component: "push.send",
      alertRoute: "p2-email",
      extra: {
        userId,
        endpoint: result.endpoint,
        statusCode: result.statusCode,
      },
    });
  }

  return out;
}
