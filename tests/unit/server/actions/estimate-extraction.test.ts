import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the PDF estimate extraction path.
 *
 * The unit surface is split into two layers, each tested independently so
 * failures point at the right seam:
 *
 *  1. `stripJsonFence` + `parseEstimateExtraction` — pure, no I/O. Covers
 *     the "Claude wrapped its output weirdly" failure modes we've hit on
 *     review-summary / onboarding paths before.
 *  2. `extractEstimateItems` — the orchestration layer. Anthropic SDK
 *     calls and Supabase signed-URL issuance are mocked; what we verify
 *     is the call shape (document-block URL source, sonnet-4-6 model,
 *     max_tokens=4096) and the error-path contract (`{ok:false,error}`
 *     never throws).
 */

describe("stripJsonFence", () => {
  it("unwraps a ```json ... ``` fenced block", async () => {
    const { stripJsonFence } = await import("@/lib/estimate-ai-parser");
    const raw = '```json\n{"total": 3000000, "items": []}\n```';
    expect(stripJsonFence(raw)).toBe('{"total": 3000000, "items": []}');
  });

  it("unwraps a bare ``` ... ``` fence", async () => {
    const { stripJsonFence } = await import("@/lib/estimate-ai-parser");
    const raw = '```\n{"a":1}\n```';
    expect(stripJsonFence(raw)).toBe('{"a":1}');
  });

  it("slices from the first '{' to the last '}' when preamble exists", async () => {
    const { stripJsonFence } = await import("@/lib/estimate-ai-parser");
    const raw = 'Here is the extraction:\n{"total": 1, "nested": {"k": 2}}\nDone.';
    expect(stripJsonFence(raw)).toBe('{"total": 1, "nested": {"k": 2}}');
  });

  it("returns the trimmed input when the payload is already clean JSON", async () => {
    const { stripJsonFence } = await import("@/lib/estimate-ai-parser");
    const raw = '  {"ok":true}  ';
    expect(stripJsonFence(raw)).toBe('{"ok":true}');
  });
});

describe("parseEstimateExtraction", () => {
  const validPayload = {
    total: 3500000,
    items: [
      {
        category: "cuisine",
        itemName: "洋食コース A",
        amount: 1200000,
        unit: "名",
        quantity: 80,
        tier: "standard",
      },
      {
        category: "attire",
        itemName: "ウェディングドレス",
        amount: 300000,
        tier: "minimum",
      },
    ],
    predictedFinal: 4100000,
    analysisNote: "衣裳と料理で一般的な追加幅を見込みました。",
  };

  it("accepts a complete, well-shaped payload", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const res = parseEstimateExtraction(JSON.stringify(validPayload));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.total).toBe(3500000);
      expect(res.data.items).toHaveLength(2);
      expect(res.data.items[0].quantity).toBe(80);
    }
  });

  it("accepts fenced JSON (end-to-end with the stripper)", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const res = parseEstimateExtraction(
      "```json\n" + JSON.stringify(validPayload) + "\n```",
    );
    expect(res.ok).toBe(true);
  });

  it("rejects malformed JSON without throwing", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const res = parseEstimateExtraction("{not-json");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/parse failed/);
  });

  it("rejects payload missing required fields (schema mismatch)", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const res = parseEstimateExtraction(
      JSON.stringify({ total: 100, items: [] }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/schema validation/);
  });

  it("accepts items[].amount being negative (discount rows like ご祝儀値引き)", async () => {
    // Round 3 (2026-05-02) — schema loosened from nonnegative() so
    // ご祝儀値引き / 早期割引 rows can flow through as negative-amount
    // line items rather than being rejected.
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const discount = {
      ...validPayload,
      items: [
        ...validPayload.items,
        {
          category: "other",
          itemName: "ご祝儀値引き",
          amount: -50000,
          tier: "unknown",
        },
      ],
    };
    const res = parseEstimateExtraction(JSON.stringify(discount));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.items).toHaveLength(3);
      expect(res.data.items[2].amount).toBe(-50000);
    }
  });

  it("rejects unknown category strings (round 3 enum strict)", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const bad = {
      ...validPayload,
      items: [{ ...validPayload.items[0], category: "music" }],
    };
    const res = parseEstimateExtraction(JSON.stringify(bad));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/schema validation/);
  });

  it("rejects unknown tier strings (round 3 enum strict)", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    const bad = {
      ...validPayload,
      items: [{ ...validPayload.items[0], tier: "luxury" }],
    };
    const res = parseEstimateExtraction(JSON.stringify(bad));
    expect(res.ok).toBe(false);
  });

  it("returns empty warnings when items sum is within 10% of total", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    // items sum = 1,500,000; total = 1,520,000 → drift ~1.3% (< 10%)
    const aligned = {
      total: 1_520_000,
      items: [
        {
          category: "cuisine",
          itemName: "料理",
          amount: 1_200_000,
          tier: "standard",
        },
        {
          category: "attire",
          itemName: "ドレス",
          amount: 300_000,
          tier: "standard",
        },
      ],
      predictedFinal: 1_800_000,
      analysisNote: "標準的な見積もり",
    };
    const res = parseEstimateExtraction(JSON.stringify(aligned));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warnings).toEqual([]);
  });

  it("emits a drift warning when items sum and total diverge by > 10%", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    // items sum = 1,500,000; total = 3,000,000 → drift = 50% (>> 10%)
    // simulates "missed half the rows" or "tax-exclusive items vs tax-incl total"
    const drifted = {
      total: 3_000_000,
      items: [
        {
          category: "cuisine",
          itemName: "料理",
          amount: 1_200_000,
          tier: "standard",
        },
        {
          category: "attire",
          itemName: "ドレス",
          amount: 300_000,
          tier: "standard",
        },
      ],
      predictedFinal: 3_500_000,
      analysisNote: "標準的な見積もり",
    };
    const res = parseEstimateExtraction(JSON.stringify(drifted));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warnings).toHaveLength(1);
      expect(res.warnings[0]).toMatch(/乖離/);
      expect(res.warnings[0]).toMatch(/不足/); // items < total
    }
  });

  it("flags 超過 (items > total) drift direction", async () => {
    const { parseEstimateExtraction } = await import(
      "@/lib/estimate-ai-parser"
    );
    // items sum = 5,000,000; total = 2,500,000 → 100% drift, items 超過
    const overcount = {
      total: 2_500_000,
      items: [
        {
          category: "cuisine",
          itemName: "料理 (合計重複)",
          amount: 5_000_000,
          tier: "standard",
        },
      ],
      predictedFinal: 2_800_000,
      analysisNote: "test",
    };
    const res = parseEstimateExtraction(JSON.stringify(overcount));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.warnings[0]).toMatch(/超過/);
    }
  });
});

// --- extractEstimateItems: orchestration layer -----------------------------

// Claude SDK call is mocked — we never hit the real API in unit tests.
const messagesCreateMock = vi.fn();
// Round 12: Files API path also mocked (buffer-based caller path).
const filesUploadMock = vi.fn();
const filesDeleteMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "APIError";
    }
  }
  // getAnthropicClient does `new Anthropic({...})`, so the default export
  // must be a real constructor (not a plain factory fn). Class shape
  // mirrors the SDK's public surface we exercise in this file.
  class AnthropicStub {
    messages = { create: messagesCreateMock };
    beta = {
      files: {
        upload: filesUploadMock,
        delete: filesDeleteMock,
      },
    };
    constructor(_opts: unknown) {}
  }
  // Attach APIError as a static so the `err instanceof Anthropic.APIError`
  // branch in extractEstimateItems still works in tests.
  (AnthropicStub as unknown as { APIError: typeof APIError }).APIError = APIError;
  return { default: AnthropicStub };
});

// Signed-URL issuance is mocked — extractEstimateItems hands the signed
// URL to Claude as a document-block URL source.
vi.mock("@/lib/supabase/storage", () => ({
  createEstimateSignedUrl: vi.fn(
    async (pdfUrl: string) => `${pdfUrl}?signed=1`,
  ),
}));

// Round 14: AiCache lookup/write are mocked so the new buffer-path cache
// has predictable hit/miss behavior. Default: every lookup misses; every
// write succeeds silently. Individual tests override these spies to
// exercise the cache-hit short-circuit path. Typed via the
// `Parameters<...>` of the imported function shapes so test assertions on
// .mock.calls[0] resolve to a real tuple type (not any[]).
const cacheGetMock = vi.fn<(hash: string) => Promise<string | null>>();
const cacheSetMock = vi.fn<
  (hash: string, response: string, model: string) => Promise<void>
>();
vi.mock("@/lib/ai-cache", () => ({
  getCachedResponse: (hash: string) => cacheGetMock(hash),
  setCachedResponse: (hash: string, response: string, model: string) =>
    cacheSetMock(hash, response, model),
}));

describe("extractEstimateItems", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.DISABLE_AI;
    messagesCreateMock.mockReset();
    filesUploadMock.mockReset();
    filesDeleteMock.mockReset();
    cacheGetMock.mockReset();
    cacheGetMock.mockResolvedValue(null);
    cacheSetMock.mockReset();
    cacheSetMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("calls Claude with a document-block URL source and sonnet-4-6 model", async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total: 2800000,
            items: [
              {
                category: "venue_fee",
                itemName: "会場使用料",
                amount: 300000,
                tier: "unknown",
              },
            ],
            predictedFinal: 3200000,
            analysisNote: "標準的な上振れ幅を見込みました。",
          }),
        },
      ],
    });
    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );

    const result = await extractEstimateItems(
      "https://cdn.supabase.co/storage/v1/object/public/estimates/p/v/e.pdf",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.modelId).toBe("claude-sonnet-4-6");
      expect(result.data.total).toBe(2800000);
    }
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = messagesCreateMock.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-6");
    expect(callArgs.max_tokens).toBe(4096);
    const userMessage = callArgs.messages[0];
    expect(userMessage.role).toBe("user");
    expect(userMessage.content[0]).toEqual({
      type: "document",
      source: {
        type: "url",
        url: expect.stringContaining("?signed=1"),
      },
    });
  });

  it("returns ok:false when ANTHROPIC_API_KEY is missing (never throws)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems("https://x/y.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("returns ok:false when Claude returns malformed JSON", async () => {
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "definitely not json {{{" }],
    });
    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems("https://x/y.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/読み取れ/);
  });

  it("returns ok:false (not throw) when the SDK rejects with a non-billing error", async () => {
    messagesCreateMock.mockRejectedValueOnce(new Error("network down"));
    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems("https://x/y.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/network down/);
  });

  // --- Round 12: Files API (buffer) path --------------------------------

  const validClaudeResponse = {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          total: 2_800_000,
          items: [
            {
              category: "venue_fee",
              itemName: "会場使用料",
              amount: 300_000,
              tier: "unknown",
            },
          ],
          predictedFinal: 3_200_000,
          analysisNote: "標準的な上振れ幅を見込みました。",
        }),
      },
    ],
  };

  it("uploads the buffer via Files API and references file_id in the document block", async () => {
    filesUploadMock.mockResolvedValueOnce({ id: "file_abc123" });
    messagesCreateMock.mockResolvedValueOnce(validClaudeResponse);
    filesDeleteMock.mockResolvedValueOnce({ id: "file_abc123" });

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );

    const buffer = Buffer.from("%PDF-1.4 fake pdf bytes");
    const result = await extractEstimateItems({
      buffer,
      filename: "estimate.pdf",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.total).toBe(2_800_000);
      // Round 14: tier discriminator on the success result.
      expect(result.tier).toBe("files-api");
    }

    // 1. Files API upload was called with the beta header inside params
    //    (SDK's FileUploadParams carries betas, not RequestOptions).
    expect(filesUploadMock).toHaveBeenCalledTimes(1);
    const uploadCall = filesUploadMock.mock.calls[0];
    expect(uploadCall[0]).toMatchObject({
      betas: ["files-api-2025-04-14"],
    });
    expect(uploadCall[0]).toHaveProperty("file");

    // 2. messages.create received the file_id reference (not a URL)
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    const userMessage = messagesCreateMock.mock.calls[0][0].messages[0];
    expect(userMessage.content[0]).toEqual({
      type: "document",
      source: { type: "file", file_id: "file_abc123" },
    });
  });

  it("best-effort deletes the uploaded file after extraction (cleanup)", async () => {
    filesUploadMock.mockResolvedValueOnce({ id: "file_xyz" });
    messagesCreateMock.mockResolvedValueOnce(validClaudeResponse);
    filesDeleteMock.mockResolvedValueOnce({ id: "file_xyz" });

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    await extractEstimateItems({
      buffer: Buffer.from("pdf bytes"),
      filename: "x.pdf",
    });

    expect(filesDeleteMock).toHaveBeenCalledTimes(1);
    const deleteCall = filesDeleteMock.mock.calls[0];
    expect(deleteCall[0]).toBe("file_xyz");
    expect(deleteCall[1]).toMatchObject({
      betas: ["files-api-2025-04-14"],
    });
  });

  it("does not throw when file cleanup itself fails (best-effort delete)", async () => {
    filesUploadMock.mockResolvedValueOnce({ id: "file_will_fail_to_delete" });
    messagesCreateMock.mockResolvedValueOnce(validClaudeResponse);
    filesDeleteMock.mockRejectedValueOnce(new Error("delete 503"));

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems({
      buffer: Buffer.from("pdf bytes"),
      filename: "x.pdf",
    });

    expect(result.ok).toBe(true);
  });

  it("returns ok:false when the Files API upload itself fails", async () => {
    filesUploadMock.mockRejectedValueOnce(new Error("upload 500"));

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems({
      buffer: Buffer.from("pdf bytes"),
      filename: "x.pdf",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/upload 500/);
    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(filesDeleteMock).not.toHaveBeenCalled();
  });

  // --- Round 14: input-hash cache + 3-tier retry --------------------

  it("returns cached extraction without uploading or calling Claude", async () => {
    cacheGetMock.mockResolvedValueOnce(
      JSON.stringify({
        total: 1_000_000,
        items: [
          {
            category: "venue_fee",
            itemName: "会場使用料",
            amount: 300_000,
            tier: "unknown",
          },
        ],
        predictedFinal: 1_200_000,
        analysisNote: "cached",
      }),
    );

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems({
      buffer: Buffer.from("identical-pdf-bytes"),
      filename: "x.pdf",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("cache");
      expect(result.data.total).toBe(1_000_000);
    }
    // Cache short-circuits BOTH the upload and the Claude call.
    expect(filesUploadMock).not.toHaveBeenCalled();
    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(filesDeleteMock).not.toHaveBeenCalled();
  });

  it("writes the canonical extraction shape to cache after a fresh Files API run", async () => {
    filesUploadMock.mockResolvedValueOnce({ id: "file_cache_write" });
    messagesCreateMock.mockResolvedValueOnce(validClaudeResponse);
    filesDeleteMock.mockResolvedValueOnce({ id: "file_cache_write" });

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    await extractEstimateItems({
      buffer: Buffer.from("write-once-pdf"),
      filename: "x.pdf",
    });

    expect(cacheSetMock).toHaveBeenCalledTimes(1);
    const [hash, payload, model] = cacheSetMock.mock.calls[0];
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(16);
    expect(model).toBe("claude-sonnet-4-6");
    // Payload is the canonical re-serialised shape, not the raw Claude text.
    const parsed = JSON.parse(payload);
    expect(parsed).toHaveProperty("total", 2_800_000);
    expect(parsed).toHaveProperty("items");
    expect(parsed).toHaveProperty("predictedFinal");
    expect(parsed).toHaveProperty("analysisNote");
  });

  it("falls back to signed URL when Files API upload errors AND fallbackPdfUrl is supplied (3-tier)", async () => {
    filesUploadMock.mockRejectedValueOnce(new Error("upload 502"));
    // The URL fallback runs runExtraction with the URL document block.
    messagesCreateMock.mockResolvedValueOnce(validClaudeResponse);

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems({
      buffer: Buffer.from("flaky-files-api"),
      filename: "x.pdf",
      fallbackPdfUrl: "https://cdn.example/estimate.pdf",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tier).toBe("signed-url");
    }
    // Files API delete is never called — there's no file_id to clean up.
    expect(filesDeleteMock).not.toHaveBeenCalled();
    // messages.create was called with the URL source (not file_id).
    const userMessage = messagesCreateMock.mock.calls[0][0].messages[0];
    expect(userMessage.content[0].source.type).toBe("url");
  });

  it("returns ok:false when Files API errors AND no fallbackPdfUrl is supplied", async () => {
    filesUploadMock.mockRejectedValueOnce(new Error("upload 503"));

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems({
      buffer: Buffer.from("no-fallback"),
      filename: "x.pdf",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/upload 503/);
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("propagates parser warnings on the buffer path (sum-vs-total drift)", async () => {
    // items sum 5,000,000 vs total 2,500,000 = 100% drift, items 超過
    filesUploadMock.mockResolvedValueOnce({ id: "file_drift" });
    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total: 2_500_000,
            items: [
              {
                category: "cuisine",
                itemName: "料理 (合計重複)",
                amount: 5_000_000,
                tier: "standard",
              },
            ],
            predictedFinal: 2_800_000,
            analysisNote: "test",
          }),
        },
      ],
    });
    filesDeleteMock.mockResolvedValueOnce({ id: "file_drift" });

    const { extractEstimateItems } = await import(
      "@/server/actions/estimate-ai"
    );
    const result = await extractEstimateItems({
      buffer: Buffer.from("pdf"),
      filename: "x.pdf",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatch(/超過/);
    }
  });
});
