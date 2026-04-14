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
  const stream = await claude.messages.stream({
    model: options.model ?? "claude-sonnet-4-6",
    max_tokens: options.maxTokens ?? 2048,
    system: options.system,
    messages: options.messages,
  });

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(event.delta.text);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
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
      // Only retry on rate limit or connection timeout
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("rate_limit") ||
          error.message.includes("timeout") ||
          error.message.includes("overloaded"));
      if (!isRetryable) throw error;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
  throw new Error("Unreachable");
}
