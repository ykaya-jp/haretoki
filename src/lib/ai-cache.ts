/**
 * Generic input-hash → response cache for Claude calls that aren't
 * project-scoped. Use `src/server/ai/cache.ts` (AiAnalysis) when the
 * caller needs project / venue scoping; use this file when the call is
 * a pure function of (system, user, model) — venue vibe extraction, URL
 * parsing, public-context recommendations.
 *
 * TTL = 30 days, app-enforced. Rows older than the cutoff are treated as
 * misses but not deleted — a future cron can sweep the table when the row
 * count gets unwieldy. For now, AiCache stays small enough that storage
 * pressure is a non-issue.
 */

import { prisma } from "@/server/db";
import { askClaude, computeInputHash, withRetry } from "@/lib/anthropic";
import { MODEL, type ModelId } from "@/lib/models";
import { logEvent } from "@/lib/observability";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function getCachedResponse(inputHash: string): Promise<string | null> {
  try {
    const row = await prisma.aiCache.findUnique({ where: { inputHash } });
    if (!row) {
      logEvent({ event: "ai_cache_lookup", fields: { outcome: "miss" } });
      return null;
    }
    if (Date.now() - row.createdAt.getTime() > TTL_MS) {
      logEvent({ event: "ai_cache_lookup", fields: { outcome: "expired" } });
      return null;
    }
    logEvent({ event: "ai_cache_lookup", fields: { outcome: "hit" } });
    return row.response;
  } catch {
    return null;
  }
}

export async function setCachedResponse(
  inputHash: string,
  response: string,
  model: string,
): Promise<void> {
  try {
    await prisma.aiCache.upsert({
      where: { inputHash },
      update: { response, model, createdAt: new Date() },
      create: { inputHash, response, model },
    });
  } catch {
    // cache write failure is non-fatal
  }
}

/**
 * Higher-order wrapper that handles cache lookup + askClaude + cache write
 * in one step. Use this for new call sites where the response is a pure
 * function of the prompt input — caller doesn't have to assemble the hash
 * recipe by hand or remember to call `setCachedResponse` on the success
 * path.
 *
 * Hash recipe is fixed: `{ system, user, model, version }`. `version` is
 * a caller-supplied prompt-version tag — bump it when the prompt semantics
 * change so old cached entries aren't served against a new contract.
 *
 * Returns `null` only if Claude itself returns null (passed through from
 * `askClaude` retry path). The caller decides whether null is fatal.
 */
export async function cachedAskClaude(opts: {
  system: string;
  userMessage: string;
  model?: ModelId;
  maxTokens?: number;
  /**
   * Bump this when the prompt or schema contract changes. Without a
   * version tag, prompt revisions silently serve stale cached output for
   * 30 days post-deploy.
   */
  promptVersion: string | number;
  /** Optional retry behavior. Defaults to 3 attempts (matches askClaude). */
  retry?: boolean;
  /**
   * Round 22: per-call upstream timeout in ms. Pass-through to askClaude
   * — same semantics as askClaude({timeoutMs}). Use this for callers
   * that previously wrapped cachedAskClaude in their own Promise.race
   * (onboarding recommendations is the canonical example: it raced a
   * 20s timer against the Claude call so the page wouldn't hang).
   * Returns null when the timeout fires (the same way an unrecoverable
   * 5xx returns null), so the caller's null-handling path covers both.
   */
  timeoutMs?: number;
}): Promise<string | null> {
  const model = opts.model ?? MODEL.HAIKU;
  const hash = computeInputHash(
    JSON.stringify({
      system: opts.system,
      user: opts.userMessage,
      model,
      version: opts.promptVersion,
      maxTokens: opts.maxTokens ?? null,
    }),
  );

  const cached = await getCachedResponse(hash);
  if (cached !== null) return cached;

  const callClaude = () =>
    askClaude({
      system: opts.system,
      userMessage: opts.userMessage,
      model,
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs,
    });

  let response: string;
  try {
    response = opts.retry === false ? await callClaude() : await withRetry(callClaude);
  } catch {
    return null;
  }

  // Best-effort write — never block the caller on cache persistence.
  await setCachedResponse(hash, response, model);
  return response;
}
