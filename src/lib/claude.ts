// Backward-compatible wrapper — delegates to anthropic.ts
export { isClaudeAvailable } from "./anthropic";
import { askClaude as askClaudeNew } from "./anthropic";

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  try {
    return await askClaudeNew({ system: systemPrompt, userMessage });
  } catch {
    return null;
  }
}
