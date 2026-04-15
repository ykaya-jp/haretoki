import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

// --- Singleton client ---
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// --- Non-streaming call ---
export async function askClaude(options: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const claude = getAnthropicClient();
  const response = await claude.messages.create({
    model: options.model ?? "claude-sonnet-4-6",
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: "user", content: options.userMessage }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");
  return textBlock.text;
}

// --- Streaming call ---
export async function streamClaude(options: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  maxTokens?: number;
}): Promise<ReadableStream<string>> {
  const claude = getAnthropicClient();
  // 30s timeout: if upstream hangs, abort the stream so we don't hold the SSE
  // connection (and the user's tab) open indefinitely.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  const stream = await claude.messages.stream(
    {
      model: options.model ?? "claude-sonnet-4-6",
      max_tokens: options.maxTokens ?? 2048,
      system: options.system,
      messages: options.messages,
    },
    { signal: controller.signal },
  );

  return new ReadableStream<string>({
    async start(streamController) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            streamController.enqueue(event.delta.text);
          }
        }
        streamController.close();
      } catch (error) {
        streamController.error(error);
      } finally {
        clearTimeout(timeoutId);
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
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
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
        isRetryable =
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
