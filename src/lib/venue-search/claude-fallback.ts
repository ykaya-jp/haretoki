/**
 * Tier 3 Claude fallback — ask the model for up to 3 wedding-venue URLs
 * that match the user's query. Used when Tier 1 (internal DB) and Tier 2
 * (Google Places) return nothing, OR when Places is disabled (no API key).
 *
 * Safety rails:
 *   - Output parsed as strict JSON. Malformed responses → [].
 *   - URLs passed through `guardExternalUrl` so private / http / localhost
 *     replies from Claude are dropped before they reach the UI.
 *   - Confidence capped at "low" — Claude-inferred URLs can be hallucinated.
 *   - Cached by input-hash so repeated queries don't re-bill Anthropic.
 */

import { askClaude, isClaudeAvailable } from "@/lib/claude";
import { computeInputHash } from "@/lib/anthropic";
import { getCachedResponse, setCachedResponse } from "@/lib/ai-cache";
import { guardExternalUrl } from "@/lib/url-guard";
import { MODEL } from "@/lib/models";
import type { VenueSearchHit } from "./types";

const SYSTEM_PROMPT = `あなたは日本の結婚式場に詳しいアシスタントです。
ユーザーの入力を式場名として解釈し、該当する日本の結婚式場の
公式サイト URL を最大 3 件返してください。
- 確信がある場合のみ返す (推測で URL を作らない)
- 日本語で書かれた公式サイトを優先
- JSON 配列で返す。各要素は { name: string, url: string, location: string | null }
- 該当が無い場合は空配列 []
- 出力は JSON のみ。前置きや説明を含めない`;

interface ClaudeFallbackItem {
  name?: unknown;
  url?: unknown;
  location?: unknown;
}

/** Strip code fences if Claude wrapped the JSON despite instructions. */
function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

/**
 * Returns up to 3 Claude-tier hits. Never throws — any failure is
 * swallowed to `[]` because Tier 3 is a fallback, not a hard guarantee.
 */
export async function fetchClaudeFallback(query: string): Promise<VenueSearchHit[]> {
  if (!isClaudeAvailable()) return [];
  const userMessage = `式場名の候補: ${query}`;

  const cacheKey = computeInputHash(`${SYSTEM_PROMPT}\n${userMessage}`);
  const cached = await getCachedResponse(cacheKey);
  const raw = cached ?? (await askClaude(SYSTEM_PROMPT, userMessage, {
    maxTokens: 512,
    // Haiku is enough for a 3-item JSON list; keeps cost under $0.003/call.
    model: MODEL.HAIKU,
  }));
  if (!raw) return [];
  if (!cached) {
    // Cache best-effort; failures are non-fatal.
    try {
      await setCachedResponse(cacheKey, raw, MODEL.HAIKU);
    } catch {
      // swallow
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const hits: VenueSearchHit[] = [];
  for (const item of parsed as ClaudeFallbackItem[]) {
    if (typeof item?.name !== "string" || typeof item?.url !== "string") continue;
    const name = item.name.trim();
    const url = item.url.trim();
    if (!name || !url) continue;
    const guard = guardExternalUrl(url);
    if (!guard.ok) continue;
    const location =
      typeof item.location === "string" && item.location.trim().length > 0
        ? item.location.trim()
        : null;
    hits.push({
      id: `claude:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
      name,
      location,
      source: "claude",
      sourceUrl: url,
      placeId: null,
      existingVenueId: null,
      confidence: "low",
    });
    if (hits.length >= 3) break;
  }
  return hits;
}
