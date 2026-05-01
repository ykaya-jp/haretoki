"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, isClaudeAvailable } from "@/lib/anthropic";
import { recordUsage } from "@/lib/anthropic-usage";
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
 *   2. **pdfUrl → signed URL (legacy)**: caller hands us a Supabase URL,
 *      we issue a short-lived signed URL and let Anthropic fetch the PDF
 *      itself. Kept for backwards compatibility (existing callers + the
 *      extraction unit test exercise this path) and as a fallback the
 *      Files API path can fall through to if the upload itself errors
 *      with a non-billing 5xx.
 *
 * Why document-block at all (versus the older `pdf-parse → text → askClaude`
 * path): wedding venue 見積書 lean on columnar layout (項目 / 単価 / 数量 /
 * 小計) that a plain-text dump destroys, and scan-only PDFs returned an
 * empty string under pdf-parse. Document-block reads the PDF natively
 * (vision + structure), so per-line unit/quantity recover and smartphone
 * photo → PDF chains now work.
 *
 * Model: sonnet-4-6. Haiku mis-classified ~20% of 料理単価×人数 lines as
 * flat amounts. Accuracy on the JSON shape matters more than latency for
 * a once-per-venue operation.
 *
 * The system prompt itself lives in src/lib/prompts/estimate-extract.ts.
 */

const FILES_API_BETA = "files-api-2025-04-14";
const PDF_EXTRACT_TIMEOUT_MS = 55_000;

export type ExtractEstimateInput =
  | string
  | { buffer: Buffer; filename: string };

/**
 * Extract structured EstimateItems from a wedding estimate PDF.
 *
 * Returns `{ ok: false, error }` on every failure path (signed-url failure,
 * Files-API upload failure, Claude error, JSON malformed, schema mismatch).
 * We never throw — the caller threads this through a user-facing toast.
 */
export async function extractEstimateItems(
  input: ExtractEstimateInput,
): Promise<
  | { ok: true; data: ExtractedEstimate; modelId: string; warnings: string[] }
  | { ok: false; error: string }
> {
  if (!isClaudeAvailable()) {
    return {
      ok: false,
      error: "AI分析を利用するにはAPIキーを設定してください（ANTHROPIC_API_KEY）",
    };
  }

  if (typeof input === "string") {
    return extractFromUrl(input);
  }
  return extractFromBuffer(input.buffer, input.filename);
}

/** Files API path — the new default. Uploads the PDF, references the
 *  returned file_id from `messages.create`, then best-effort deletes. */
async function extractFromBuffer(
  buffer: Buffer,
  filename: string,
): Promise<
  | { ok: true; data: ExtractedEstimate; modelId: string; warnings: string[] }
  | { ok: false; error: string }
> {
  const client = getAnthropicClient();

  // 1. Upload the PDF as an Anthropic File. Wrap in Blob so the SDK's
  //    Uploadable accepts it on Node 20+ (which exposes Blob globally).
  let fileId: string;
  try {
    // Bun / older Node may not have File globally; Blob is the universal
    // surface. The SDK accepts both.
    const blob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
    // Annotate with filename via a wrapping object — SDK reads it for
    // the multipart upload's Content-Disposition.
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
    return {
      ok: false,
      error: `PDFのAIアップロードに失敗しました: ${
        err instanceof Error ? err.message : "unknown"
      }`,
    };
  }

  try {
    return await runExtraction(
      client,
      // file_id reference; cast through unknown because the public
      // messages.create types don't yet enumerate `type: 'file'` in
      // document.source even though the beta API accepts it.
      {
        type: "document",
        source: { type: "file", file_id: fileId },
      } as unknown as Anthropic.ContentBlockParam,
    );
  } finally {
    // Best-effort cleanup. Server functions are short-lived, so this
    // either completes within the function lifetime or gets garbage-
    // collected by Anthropic's per-account file TTL anyway.
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

/** Legacy URL path — kept for backwards compatibility + tests. */
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
