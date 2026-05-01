"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, isClaudeAvailable } from "@/lib/anthropic";
import { MODEL } from "@/lib/models";
import { createEstimateSignedUrl } from "@/lib/supabase/storage";
import {
  parseEstimateExtraction,
  type ExtractedEstimate,
} from "@/lib/estimate-ai-parser";
import { ESTIMATE_EXTRACT_SYSTEM_PROMPT } from "@/lib/prompts/estimate-extract";

/**
 * PDF estimate extraction via Claude's document-block API.
 *
 * Why document-block over the old `pdf-parse → text → askClaude` path:
 *  - Wedding venue 見積書 rely heavily on columnar layout (項目 / 単価 /
 *    数量 / 小計) which a plain-text dump obliterates. Claude's native
 *    PDF understanding preserves that structure and recovers per-line
 *    quantity / unit, letting us fill EstimateItem.tier and quantity.
 *  - Scanned PDFs (image-only) returned an empty string under pdf-parse
 *    and the whole pipeline collapsed. document-block handles those via
 *    vision, so the typical smartphone photo → PDF chain now works.
 *
 * Model: sonnet-4-6. Haiku was attempted here early on and mis-classified
 * around 20% of 料理単価 × 人数 lines as flat amounts. Accuracy on the
 * JSON shape matters more than latency for a once-per-venue operation.
 *
 * The system prompt itself lives in src/lib/prompts/estimate-extract.ts
 * (paired with docs/ai/prompts/estimate-extract.system.md) so it shows up
 * in the standard prompts directory rather than being buried inline here.
 */

/**
 * Pull structured EstimateItems out of a wedding estimate PDF using
 * Claude's document-block API.
 *
 * Caller supplies a pdfUrl (typically a just-uploaded Supabase public
 * URL). We derive a short-lived signed URL so the private `estimates`
 * bucket stays locked down — Anthropic only needs the document for the
 * duration of the single extraction call.
 *
 * max_tokens=4096: a long estimate regularly has 30-50 line items;
 * 2048 truncated mid-array and cratered the JSON parse. 4096 clears
 * a realistic worst case and still caps cost.
 *
 * Returns `{ ok: false, error }` for every failure path (signed-url
 * failure, Claude error, JSON malformed, schema mismatch). We never
 * throw because the caller threads this through a user-facing toast.
 */
export async function extractEstimateItems(
  pdfUrl: string,
): Promise<
  | { ok: true; data: ExtractedEstimate; modelId: string }
  | { ok: false; error: string }
> {
  if (!isClaudeAvailable()) {
    return {
      ok: false,
      error: "AI分析を利用するにはAPIキーを設定してください（ANTHROPIC_API_KEY）",
    };
  }

  // Claude fetches the PDF itself via URL — the bucket is private so we
  // hand it a time-boxed signed URL rather than the raw public one.
  let fetchableUrl: string;
  try {
    fetchableUrl = await createEstimateSignedUrl(pdfUrl);
  } catch (err) {
    return {
      ok: false,
      error: `PDFの一時URL発行に失敗しました: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  const client = getAnthropicClient();
  let response;
  // PDF extraction can take tens of seconds on long estimates.
  // Cap at 55s so we return gracefully before Vercel's 60s function limit.
  const PDF_EXTRACT_TIMEOUT_MS = 55_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PDF_EXTRACT_TIMEOUT_MS);
  try {
    response = await client.messages.create(
      {
        model: MODEL.SONNET,
        max_tokens: 4096,
        system: ESTIMATE_EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "url",
                  url: fetchableUrl,
                },
              },
              {
                type: "text",
                text: "このPDFから構造化データを抽出してJSONで返してください。",
              },
            ],
          },
        ],
      },
      { signal: controller.signal },
    );
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: "AI分析が時間内に完了しませんでした。ページ数の少ないPDFでお試しください",
      };
    }
    if (err instanceof Anthropic.APIError) {
      if (err.message.includes("credit balance") || err.message.includes("billing")) {
        return { ok: false, error: "AI利用枠が一時的に上限に達しました。少し時間をおいてお試しください" };
      }
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? `AI分析に失敗しました: ${err.message}`
          : "AI分析に失敗しました",
    };
  } finally {
    clearTimeout(timeoutId);
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return {
      ok: false,
      error: "AIから応答を取得できませんでした。もう一度お試しください",
    };
  }

  const parsed = parseEstimateExtraction(textBlock.text);
  if (!parsed.ok) {
    console.warn("[extractEstimateItems] parse failed", {
      preview: textBlock.text.slice(0, 400),
      error: parsed.error,
    });
    return {
      ok: false,
      error: "AIの応答をうまく読み取れませんでした。もう一度お試しください",
    };
  }

  return { ok: true, data: parsed.data, modelId: MODEL.SONNET };
}
