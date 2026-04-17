// Backward-compatible wrapper — delegates to anthropic.ts
export { isClaudeAvailable } from "./anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { askClaude as askClaudeNew } from "./anthropic";

export class ClaudeCreditsError extends Error {
  constructor() {
    super("Anthropic API credit balance is too low");
    this.name = "ClaudeCreditsError";
  }
}

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  try {
    return await askClaudeNew({ system: systemPrompt, userMessage });
  } catch (err) {
    // Surface credit/billing errors so callers can show a specific message
    if (
      err instanceof Anthropic.APIError &&
      (err.message.includes("credit balance") || err.message.includes("billing"))
    ) {
      throw new ClaudeCreditsError();
    }
    console.error("[claude] askClaude failed:", err);
    return null;
  }
}
