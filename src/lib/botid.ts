/**
 * Vercel BotID server wrapper.
 *
 * Centralises the `checkBotId()` call so individual route handlers stay
 * one-liner. Returns a normalised verdict that's easy to act on:
 *
 *   - `{ blocked: false }` — request looks human (or BotID disabled),
 *     proceed normally.
 *   - `{ blocked: true, reason }` — request was flagged. Caller should
 *     return 403 + Sentry-log.
 *
 * Graceful degradation: when `BOT_ID_ENABLED` env var is unset (local
 * dev / CI / preview without BotID provisioned), the wrapper short-
 * circuits to `{ blocked: false }` so no path becomes accidentally
 * unreachable. Set `BOT_ID_ENABLED=1` in Vercel production env to turn
 * on enforcement.
 *
 * Pair this with the `BotIdClient` component mounted in
 * `src/app/layout.tsx` — without that, the SDK has no client-side
 * signals and treats every request as a bot.
 */

import { checkBotId } from "botid/server";
import { captureMessage } from "@/lib/sentry";
import { logEvent } from "@/lib/observability";

export interface BotCheckResult {
  blocked: boolean;
  reason?: string;
}

export function isBotIdEnabled(): boolean {
  return process.env.BOT_ID_ENABLED === "1" || process.env.BOT_ID_ENABLED === "true";
}

/**
 * Check whether the current request looks like a bot. Logs the
 * verdict to Sentry as an info-level message so we can build a
 * baseline detection rate before tightening any thresholds.
 */
export async function detectBot(scope: string): Promise<BotCheckResult> {
  if (!isBotIdEnabled()) return { blocked: false };

  try {
    const verdict = await checkBotId();
    if (verdict.isBot) {
      captureMessage("[botid] request flagged as bot", {
        level: "warning",
        component: "botid",
        alertRoute: "p3-digest",
        extra: { scope },
      });
      logEvent({ event: "botid_block", fields: { scope } });
      return { blocked: true, reason: "bot-detected" };
    }
    return { blocked: false };
  } catch {
    // BotID transient failure — fail open. The alternative (fail
    // closed) would block legitimate users every time the BotID
    // service hiccups, which trades a known cost for an unknown one.
    return { blocked: false };
  }
}
