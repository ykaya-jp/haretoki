import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { recordUsage } from "@/lib/anthropic-usage";

// --- Singleton client ---
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set or empty");
  }
  if (!client) {
    client = new Anthropic({ apiKey: key });
  }
  return client;
}

/**
 * Check if Claude AI features are available.
 * Developers can disable AI via DISABLE_AI=1 env var for testing without credits.
 */
export function isClaudeAvailable(): boolean {
  // Developer kill-switch: set DISABLE_AI=1 to disable all AI features
  if (process.env.DISABLE_AI === "1" || process.env.DISABLE_AI === "true") {
    return false;
  }
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    console.warn("[isClaudeAvailable] ANTHROPIC_API_KEY is missing or empty. Env keys containing 'ANTHROPIC':",
      Object.keys(process.env).filter(k => k.includes("ANTHROPIC")));
  }
  return !!key;
}

// Default upstream-call budget for non-streaming Claude requests. Kept under
// the Vercel Serverless Function default (60s) so we surface an abort before
// the platform kills the whole function and returns a generic 504. Callers
// that need more (e.g. long PDF extraction) can pass `timeoutMs` explicitly.
const DEFAULT_CLAUDE_TIMEOUT_MS = 45_000;

// --- Non-streaming call ---
export async function askClaude(options: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  /**
   * Upstream timeout in ms. When the Anthropic call exceeds this budget we
   * abort the HTTP request so the server action can either retry or fall
   * back gracefully instead of holding the user's tab open until the
   * platform-level function timeout fires.
   */
  timeoutMs?: number;
  /**
   * Free-form action label for usage accounting (e.g. "coach", "onboarding-rec").
   * Optional — when omitted the structured `ai_call` log just lacks the action
   * tag and budget aggregation still works.
   */
  action?: string;
}): Promise<string> {
  const claude = getAnthropicClient();
  const model = options.model ?? "claude-haiku-4-5-20251001";
  const budget = options.timeoutMs ?? DEFAULT_CLAUDE_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), budget);
  try {
    const response = await claude.messages.create(
      {
        model,
        max_tokens: options.maxTokens ?? 4096,
        system: options.system,
        messages: [{ role: "user", content: options.userMessage }],
      },
      { signal: controller.signal },
    );
    // Usage accounting (sync, never throws) — pulls input/output token
    // counts from the SDK response and feeds the per-instance bucket the
    // daily cost-summary cron later snapshots.
    recordUsage({
      model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      action: options.action,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("No text response from Claude");
    return textBlock.text;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Streaming call ---
export async function streamClaude(options: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  maxTokens?: number;
  /** Free-form action label for usage accounting (see askClaude). */
  action?: string;
}): Promise<ReadableStream<string>> {
  const claude = getAnthropicClient();
  const model = options.model ?? "claude-haiku-4-5-20251001";
  // 30s timeout: if upstream hangs, abort the stream so we don't hold the SSE
  // connection (and the user's tab) open indefinitely.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const stream = await claude.messages.stream(
    {
      model,
      max_tokens: options.maxTokens ?? 2048,
      system: options.system,
      messages: options.messages,
    },
    { signal: controller.signal },
  );

  return new ReadableStream<string>({
    async start(streamController) {
      // Final usage tally arrives in the message_delta event's `usage`
      // field (Anthropic SDK semantics). Fall back to the finalMessage
      // helper if we somehow miss the event-stream tally.
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            streamController.enqueue(event.delta.text);
          } else if (event.type === "message_start") {
            inputTokens = event.message.usage?.input_tokens ?? inputTokens;
            outputTokens = event.message.usage?.output_tokens ?? outputTokens;
          } else if (event.type === "message_delta") {
            // message_delta carries the cumulative output_tokens for the
            // turn; the input_tokens we captured at message_start.
            outputTokens = event.usage?.output_tokens ?? outputTokens;
          }
        }
        streamController.close();
      } catch (error) {
        streamController.error(error);
      } finally {
        clearTimeout(timeoutId);
        // Account even on partial streams — cost was incurred up to the
        // point we cancelled. Zeros are filtered out inside recordUsage.
        recordUsage({
          model,
          inputTokens,
          outputTokens,
          action: options.action,
        });
      }
    },
  });
}

// --- Input hash for deduplication ---
export function computeInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// --- PII stripping ---
const PII_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
  /0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}/g, // Japanese phone
  /\d{3}-\d{4}/g, // postal code
  /[一-龥ぁ-んァ-ヶ]{1,4}(様|さん|くん|ちゃん)/g, // honorific names
];

export function stripPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

// --- Prompt-injection sanitization for untrusted user-sourced data ---
// Venue names, favorites, conditions can originate from URL-scraped sites or
// raw user input. When those strings are interpolated into Claude's system
// prompt they must be neutralized: strip tags that could close our delimiter,
// and shorten to avoid giving attackers room to maneuver.
export function sanitizeForPrompt(text: string, maxLen: number = 120): string {
  return text
    .replace(/<\/?[^>]*>/g, "") // strip angle-bracket tags
    .replace(/[\r\n]+/g, " ") // flatten newlines
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// --- Retry with exponential backoff ---
// baseDelay 1500ms (was 1000ms): when Sonnet hits 429/529 under burst
// load (e.g. user adds several venues back-to-back), 1s × 2^attempt
// gave bursts of 1s/2s/4s = 7s of total backoff. 1.5s × 2^attempt
// yields 1.5s/3s/6s = 10.5s, which fits inside the 60s upstream budget
// while giving Anthropic's rate limiter more breathing room.
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1500,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // Prefer instance check on the SDK's APIError class, which carries a
      // stable HTTP status. 429 = rate-limited, 503 = service unavailable,
      // 529 = overloaded (Anthropic-specific). Fall back to message string
      // matching for non-SDK errors (e.g. fetch-level timeouts).
      let isRetryable = false;
      if (error instanceof Anthropic.APIError) {
        const status = error.status;
        isRetryable = status === 429 || status === 503 || status === 529;
      } else if (error instanceof Error) {
        // AbortError is what our AbortController-based timeout raises; treat
        // it the same as a network timeout so transient upstream hangs get
        // one more shot before falling through to the caller.
        isRetryable =
          error.name === "AbortError" ||
          error.message.includes("rate_limit") ||
          error.message.includes("timeout") ||
          error.message.includes("overloaded");
      }
      if (!isRetryable) throw error;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
  throw new Error("Unreachable");
}
