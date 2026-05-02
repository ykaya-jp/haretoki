"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { captureError } from "@/lib/sentry";

/**
 * Server actions for the Web Push subscription lifecycle (Track B-1).
 *
 * The browser owns the source of truth — when `pushManager.subscribe()`
 * resolves on the client, we POST the resulting `PushSubscription`
 * shape here for storage. The backend never originates a subscription;
 * it only records / removes what the browser tells it about.
 *
 * Storage shape: one row per (user, endpoint) in `push_subscriptions`.
 * The `endpoint` URL is unique per browser-install (per Web Push spec)
 * so we upsert on it — re-subscribing after a permission toggle just
 * refreshes the row, never duplicates it.
 *
 * Auth: every action requires an authenticated user. Anonymous push
 * subscriptions don't make sense for Haretoki (couples-only product).
 */

/**
 * Browser-side `PushSubscription.toJSON()` shape, narrowed to what we
 * actually persist. The W3C spec guarantees `endpoint`, `keys.p256dh`,
 * `keys.auth` for any subscription that came from `subscribe()`.
 */
const subscribeSchema = z.object({
  endpoint: z.string().url("不正な endpoint です").max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
  /** Truncated User-Agent — caller passes navigator.userAgent. */
  userAgent: z.string().max(512).optional(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;

export interface SubscribeResult {
  ok: boolean;
  /** Stable id of the row (uuid). Caller doesn't need it but the test
   *  asserts on it to verify the upsert returned a valid row. */
  id?: string;
  error?: string;
}

/**
 * Persist a subscription returned by the browser. Upserts on
 * `endpoint` so the same browser re-subscribing after a permission
 * toggle, page reload, or service-worker update doesn't pile up
 * duplicate rows. Always best-effort — a DB failure is reported to
 * Sentry but the user-visible flow continues (the browser still has
 * the subscription; we just couldn't persist it).
 */
export async function saveSubscription(
  input: SubscribeInput,
): Promise<SubscribeResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "通知の登録情報が不正です" };
  }

  const user = await requireUser();
  // Truncate UA at 256 chars (matches audit_logs convention).
  const userAgent = parsed.data.userAgent
    ? parsed.data.userAgent.slice(0, 256)
    : null;

  try {
    const row = await prisma.pushSubscription.upsert({
      where: { endpoint: parsed.data.endpoint },
      // Same user re-subscribing — refresh keys + UA in case they
      // rotated. Different user pointing at the same endpoint should
      // never happen (endpoint is per-browser-install, browsers don't
      // share between accounts), but if it does we overwrite to the
      // current authenticated user — the browser identity wins.
      update: {
        userId: user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent,
      },
      create: {
        userId: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent,
      },
      select: { id: true },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    captureError(err, {
      component: "auth",
      alertRoute: "p3-digest",
      extra: { action: "push-subscription:save" },
    });
    return { ok: false, error: "通知の登録に失敗しました" };
  }
}

/**
 * Remove a subscription by its endpoint. Called when:
 *   - the browser's `subscription.unsubscribe()` succeeds (user
 *     opted out from our settings UI)
 *   - the dispatcher (B-2) gets a 404 / 410 from web-push (user
 *     disabled at OS level — the row is dead and we should clean up)
 *
 * Auth-scoped: we only delete rows that belong to the current user.
 * Defends against a malicious caller passing someone else's endpoint
 * (which would otherwise be guessable from a leaked log line).
 */
const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export async function removeSubscription(
  input: z.input<typeof unsubscribeSchema>,
): Promise<{ ok: boolean; removed: number }> {
  const parsed = unsubscribeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, removed: 0 };

  const user = await requireUser();

  try {
    // deleteMany (not delete) so the auth scope check + 404-tolerant
    // behaviour are the same call. Returns count=0 if the endpoint
    // belonged to someone else or was already gone.
    const result = await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: user.id },
    });
    return { ok: true, removed: result.count };
  } catch (err) {
    captureError(err, {
      component: "auth",
      alertRoute: "p3-digest",
      extra: { action: "push-subscription:remove" },
    });
    return { ok: false, removed: 0 };
  }
}

/**
 * List the current user's subscriptions for the settings UI. Returns
 * a small projection (no raw keys — those are write-only) so the page
 * can render "MacBook (Chrome) — added 2 weeks ago" entries.
 */
export interface MySubscriptionRow {
  id: string;
  userAgent: string | null;
  createdAt: Date;
}

export async function listMySubscriptions(): Promise<MySubscriptionRow[]> {
  const user = await requireUser();
  const rows = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, userAgent: true, createdAt: true },
  });
  return rows;
}
