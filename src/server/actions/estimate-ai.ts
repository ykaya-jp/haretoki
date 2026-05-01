"use server";

import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, isClaudeAvailable } from "@/lib/anthropic";
import { recordUsage } from "@/lib/anthropic-usage";
import { MODEL } from "@/lib/models";
import { createEstimateSignedUrl } from "@/lib/supabase/storage";
import { getCachedResponse, setCachedResponse } from "@/lib/ai-cache";
import {
  parseEstimateExtraction,
  type ExtractedEstimate,
} from "@/lib/estimate-ai-parser";
import { ESTIMATE_EXTRACT_SYSTEM_PROMPT } from "@/lib/prompts/estimate-extract";

/**
 * PDF estimate extraction via Claude's document-block API.
 *
 * Two input paths, both produce the same shape:
 *
 *   1. **Buffer + filename → Anthropic Files API (preferred, since round
 *      12 / 2026-05-02)**: caller hands us the raw PDF bytes; we upload
 *      to `client.beta.files.upload`, reference the returned file_id in
 *      `messages.create` via `{ type: 'document', source: { type: 'file',
 *      file_id } }`, and best-effort delete the file when done. This
 *      lifts the practical PDF cap from base64 inline (~5MB workable) to
 *      the Files API limit (~32MB), and per-instance file ids can be
 *      re-used across calls in the same turn (we don't yet, but the door
 *      is open).
 *
 *   2. **pdfUrl → signed URL (legacy + Files-API fallback)**: caller hands
 *      us a Supabase URL, we issue a short-lived signed URL and let
 *      Anthropic fetch the PDF itself. Kept as the legacy path AND as
 *      the auto-fallback for the Files API (round 14): if the buffer
 *      caller also supplies `fallbackPdfUrl` and the Files API upload
 *      itself errors, we transparently switch to URL mode rather than
 *      failing the whole extraction.
 *
 * Round 14 also adds an input-hash cache (AiCache table, 30d TTL): the
 * key is sha256({ buffer-sha256, system, model, version }), so the same
 * PDF re-uploaded by the same project hits cache and skips Claude
 * entirely. This closes the last gap in the AI cache coverage audit
 * (every other prompt was already cached).
 */

const FILES_API_BETA = "files-api-2025-04-14";
const PDF_EXTRACT_TIMEOUT_MS = 55_000;
// Bump when ESTIMATE_EXTRACT_SYSTEM_PROMPT semantics change so cached
// extractions from a prior prompt revision aren't served against the new
// schema contract.
const ESTIMATE_EXTRACT_PROMPT_VERSION = 1;

export type ExtractEstimateInput =
  | string
  | {
      buffer: Buffer;
      filename: string;
      /** Round 14: when supplied, the buffer/Files API path will fall
       *  through to URL mode using this as the second-tier source if the
       *  Files API upload itself errors. Caller (`analyzeEstimatePdf`)
       *  passes the just-uploaded Supabase pdfUrl. */
      fallbackPdfUrl?: string;
    };

/**
 * Extract structured EstimateItems from a wedding estimate PDF.
 *
 * Returns `{ ok: false, error }` on every failure path. We never throw —
 * the caller threads this through a user-facing toast.
 */
export async function extractEstimateItems(
  input: ExtractEstimateInput,
): Promise<
  | {
      ok: true;
      data: ExtractedEstimate;
      modelId: string;
      warnings: string[];
      /** Which extraction tier produced the answer. Useful for telemetry
       *  + lets the caller log when fallback fired. */
      tier: "files-api" | "signed-url" | "cache";
    }
  | { ok: false; error: string }
> {
  if (!isClaudeAvailable()) {
    return {
      ok: false,
      error: "AI分析を利用するにはAPIキーを設定してください（ANTHROPIC_API_KEY）",
    };
  }

  if (typeof input === "string") {
    const result = await extractFromUrl(input);
    return result.ok ? { ...result, tier: "signed-url" } : result;
  }
  return extractFromBuffer(input.buffer, input.filename, input.fallbackPdfUrl);
}

/** Files API path — the new default, with optional URL fallback. */
async function extractFromBuffer(
  buffer: Buffer,
  filename: string,
  fallbackPdfUrl: string | undefined,
): Promise<
  | {
      ok: true;
      data: ExtractedEstimate;
      modelId: string;
      warnings: string[];
      tier: "files-api" | "signed-url" | "cache";
    }
  | { ok: false; error: string }
> {
  // ---- Cache lookup ------------------------------------------------------
  // Same PDF bytes + same prompt + same model → same JSON. The hash is
  // small (16 hex chars) so AiCache's UNIQUE(inputHash) is kind to it.
  // Skip the upload AND Claude round-trip when we hit.
  const cacheHash = computeBufferCacheHash(buffer);
  try {
    const cached = await getCachedResponse(cacheHash);
    if (cached) {
      const reparsed = parseEstimateExtraction(cached);
      if (reparsed.ok) {
        return {
          ok: true,
          data: reparsed.data,
          modelId: MODEL.SONNET,
          warnings: reparsed.warnings,
          tier: "cache",
        };
      }
      // Cached row is somehow corrupt (schema changed mid-deploy?) — fall
      // through to a fresh generation rather than serve garbage.
      console.warn(
        "[extractEstimateItems] cache row failed re-parse, regenerating",
      );
    }
  } catch (err) {
    console.warn("[extractEstimateItems] cache lookup failed (non-fatal)", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // ---- Tier 1: Files API -------------------------------------------------
  const client = getAnthropicClient();
  let fileId: string | null = null;
  let uploadError: unknown = null;
  try {
    const blob = new Blob([new Uint8Array(buffer)], {
      type: "application/pdf",
    });
    const uploadable =
      typeof File !== "undefined"
        ? new File([blob], filename, { type: "application/pdf" })
        : blob;
    const uploaded = await client.beta.files.upload({
      file: uploadable,
      betas: [FILES_API_BETA],
    });
    fileId = uploaded.id;
  } catch (err) {
    uploadError = err;
    // Hard 4xx errors (billing, auth, validation) shouldn't burn into the
    // URL fallback path — let them surface so the caller's toast is honest.
    if (err instanceof Anthropic.APIError) {
      if (
        err.message.includes("credit balance") ||
        err.message.includes("billing")
      ) {
        return {
          ok: false,
          error: "AI利用枠が一時的に上限に達しました。少し時間をおいてお試しください",
        };
      }
    }
  }

  // ---- Tier 2: signed URL fallback when Files API upload itself errored --
  if (!fileId) {
    if (fallbackPdfUrl) {
      console.warn(
        "[extractEstimateItems] Files API upload failed, falling back to signed URL",
        {
          message:
            uploadError instanceof Error ? uploadError.message : String(uploadError),
        },
      );
      const fallback = await extractFromUrl(fallbackPdfUrl);
      if (fallback.ok) {
        // Best-effort cache write under the buffer hash even though we
        // produced the answer via URL — the inputs are the same byte-for-
        // byte, so cache reuse is sound.
        void setCachedResponse(
          cacheHash,
          JSON.stringify({
            total: fallback.data.total,
            items: fallback.data.items,
            predictedFinal: fallback.data.predictedFinal,
            analysisNote: fallback.data.analysisNote,
          }),
          MODEL.SONNET,
        );
        return { ...fallback, tier: "signed-url" };
      }
      return fallback;
    }
    // No fallback URL provided — fail with the upload error so caller can
    // distinguish from a Claude-side failure.
    return {
      ok: false,
      error: `PDFのAIアップロードに失敗しました: ${
        uploadError instanceof Error ? uploadError.message : "unknown"
      }`,
    };
  }

  // ---- Tier 1 succeeded: run extraction with file_id reference -----------
  try {
    const result = await runExtraction(client, {
      type: "document",
      source: { type: "file", file_id: fileId },
    } as unknown as Anthropic.ContentBlockParam);

    if (result.ok) {
      // Cache the raw JSON the parser already validated. Write the canonical
      // shape (re-stringified parsed data) so re-parses on cache hit don't
      // re-encounter any non-deterministic Claude formatting quirks.
      void setCachedResponse(
        cacheHash,
        JSON.stringify({
          total: result.data.total,
          items: result.data.items,
          predictedFinal: result.data.predictedFinal,
          analysisNote: result.data.analysisNote,
        }),
        MODEL.SONNET,
      );
      return { ...result, tier: "files-api" };
    }
    return result;
  } finally {
    // Best-effort cleanup. Anthropic's per-account file TTL backstops
    // failure cases here.
    void client.beta.files
      .delete(fileId, { betas: [FILES_API_BETA] })
      .catch((err) => {
        console.warn("[extractEstimateItems] file cleanup failed", {
          fileId,
          message: err instanceof Error ? err.message : String(err),
        });
      });
  }
}

/** Legacy URL path — also serves as Tier 2 for the buffer caller. */
async function extractFromUrl(
  pdfUrl: string,
): Promise<
  | { ok: true; data: ExtractedEstimate; modelId: string; warnings: string[] }
  | { ok: false; error: string }
> {
  let fetchableUrl: string;
  try {
    fetchableUrl = await createEstimateSignedUrl(pdfUrl);
  } catch (err) {
    return {
      ok: false,
      error: `PDFの一時URL発行に失敗しました: ${
        err instanceof Error ? err.message : "unknown"
      }`,
    };
  }

  const client = getAnthropicClient();
  return runExtraction(client, {
    type: "document",
    source: { type: "url", url: fetchableUrl },
  });
}

/** Shared messages.create + parse path. Only the document content block
 *  varies between buffer / url. */
async function runExtraction(
  client: Anthropic,
  documentBlock: Anthropic.ContentBlockParam,
): Promise<
  | { ok: true; data: ExtractedEstimate; modelId: string; warnings: string[] }
  | { ok: false; error: string }
> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    PDF_EXTRACT_TIMEOUT_MS,
  );
  let response: Anthropic.Message;
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
              documentBlock,
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
        error:
          "AI分析が時間内に完了しませんでした。ページ数の少ないPDFでお試しください",
      };
    }
    if (err instanceof Anthropic.APIError) {
      if (
        err.message.includes("credit balance") ||
        err.message.includes("billing")
      ) {
        return {
          ok: false,
          error:
            "AI利用枠が一時的に上限に達しました。少し時間をおいてお試しください",
        };
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

  // Cost accounting — askClaude wraps this for non-PDF calls; this
  // direct messages.create branch needs its own recordUsage so the
  // daily cost summary cron sees PDF spend too.
  recordUsage({
    model: MODEL.SONNET,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    action: "estimate-pdf",
  });

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

  if (parsed.warnings.length > 0) {
    console.warn("[extractEstimateItems] extraction warnings", {
      warnings: parsed.warnings,
    });
  }

  return {
    ok: true,
    data: parsed.data,
    modelId: MODEL.SONNET,
    warnings: parsed.warnings,
  };
}

/** Hash recipe for the buffer-path cache. Pure function of (PDF bytes,
 *  prompt, model, version) — same recipe as cachedAskClaude / aiAnalysis
 *  callers so a future migration to a single helper stays straightforward. */
function computeBufferCacheHash(buffer: Buffer): string {
  const bufferSha = createHash("sha256").update(buffer).digest("hex");
  return createHash("sha256")
    .update(
      JSON.stringify({
        buffer: bufferSha,
        system: ESTIMATE_EXTRACT_SYSTEM_PROMPT,
        model: MODEL.SONNET,
        version: ESTIMATE_EXTRACT_PROMPT_VERSION,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}
