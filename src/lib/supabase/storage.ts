import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pick a Supabase client for Storage writes.
 *
 * Prefer the service-role admin client when `SUPABASE_SERVICE_ROLE_KEY`
 * is configured: it bypasses RLS on `storage.objects`, which is the usual
 * cause of "uploads silently fail on some envs but not others" — a bucket
 * may exist but user-scoped INSERT lack a policy row. The server action
 * layer has already authenticated the caller and verified project
 * membership, so bypassing storage RLS is safe here.
 *
 * Falls back to the user-scoped client when admin isn't configured so
 * local dev without SUPABASE_SERVICE_ROLE_KEY still works.
 */
async function getStorageClient() {
  const admin = createAdminClient();
  if (admin) return admin;
  return createClient();
}

/**
 * Bucket self-heal — buckets sometimes go missing on Supabase project
 * swaps / re-provisioning, and "Bucket not found" is otherwise invisible
 * to end users (upload throws → generic toast). Cache per-process so we
 * pay the create roundtrip at most once per cold start per bucket.
 */
const bucketExistsCache = new Set<string>();

type BucketOptions = {
  public: boolean;
  fileSizeLimit: number;
  allowedMimeTypes: string[];
};

const BUCKET_OPTIONS: Record<string, BucketOptions> = {
  "venue-photos": {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/avif",
    ],
  },
  estimates: {
    public: false,
    // Round 12 (2026-05-02) — bumped from 20MB to 32MB so multi-page /
    // image-heavy 見積書 PDFs flow through. The Anthropic Files API path
    // (src/server/actions/estimate-ai.ts) is the binding ceiling at 32MB,
    // so this matches.
    fileSizeLimit: 32 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"],
  },
};

async function ensureBucket(
  supabase: Awaited<ReturnType<typeof getStorageClient>>,
  bucket: string,
): Promise<void> {
  if (bucketExistsCache.has(bucket)) return;
  const options = BUCKET_OPTIONS[bucket];
  if (!options) {
    bucketExistsCache.add(bucket);
    return;
  }
  // Idempotent — if the bucket already exists, createBucket returns a
  // "duplicate" error we swallow. Avoids the cold-start race condition
  // that listBuckets + createBucket would otherwise have.
  const { error } = await supabase.storage.createBucket(bucket, options);
  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.warn("[storage] ensureBucket create failed", {
      bucket,
      error: error.message,
    });
  }
  bucketExistsCache.add(bucket);
}

/**
 * Upload a PDF file to Supabase Storage.
 *
 * NOTE: The "estimates" bucket must be created in the Supabase Dashboard
 * before using this function. Go to Storage → New Bucket → name: "estimates".
 * Set it as private (not public) for security.
 */
export async function uploadEstimatePdf(
  file: Buffer,
  fileName: string,
  projectId: string,
  venueId: string,
): Promise<string> {
  const supabase = await getStorageClient();
  await ensureBucket(supabase, "estimates");
  const path = `${projectId}/${venueId}/estimates/${fileName}`;

  const { data, error } = await supabase.storage
    .from("estimates")
    .upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) throw new Error(`PDFのアップロードに失敗しました: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("estimates")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Supabase storage error messages that are worth retrying. Transient 5xx
 * and gateway-level hiccups occasionally surface here even when the rest
 * of the pipeline is healthy — a single retry typically resolves them
 * without user-visible failure.
 *
 * NOT retryable: bucket-not-found, RLS, mime rejection, size-limit — those
 * are config/input errors that won't fix themselves.
 */
function isRetryableSupabaseStorageError(message: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) return false;
  if (m.includes("policy")) return false;
  if (m.includes("mime")) return false;
  if (m.includes("allowed_mime_types")) return false;
  if (m.includes("the resource already exists")) return false;
  if (m.includes("duplicate")) return false;
  if (m.includes("exceeds maximum")) return false;
  // Everything else (network blips, 5xx, timeouts) gets a single retry.
  return true;
}

/**
 * Upload a venue photo to Supabase Storage.
 *
 * NOTE: The "venue-photos" bucket must be created in the Supabase Dashboard.
 * Go to Storage → New Bucket → name: "venue-photos". Set it as public.
 *
 * Retries once on transient errors (not on config/input errors) — Supabase
 * Storage occasionally returns 5xx under load; a single retry after a short
 * backoff saves a user-visible failure without hammering the service.
 */
export async function uploadVenuePhoto(
  file: Buffer,
  fileName: string,
  projectId: string,
  venueId: string,
): Promise<string> {
  const supabase = await getStorageClient();
  await ensureBucket(supabase, "venue-photos");
  const extRaw = (fileName.split(".").pop() ?? "jpg").toLowerCase();
  // Normalise known aliases; default unknown extensions to jpg so Supabase
  // doesn't reject on a bucket MIME whitelist.
  const ext = extRaw === "jpeg" ? "jpg" : extRaw;
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${projectId}/${venueId}/${uniqueName}`;
  const contentType =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : ext === "heic" || ext === "heif"
          ? "image/heic"
          : "image/jpeg";

  const maxAttempts = 2;
  let lastError: { message: string } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, error } = await supabase.storage
      .from("venue-photos")
      .upload(path, file, { contentType, upsert: false });

    if (!error) {
      const { data: urlData } = supabase.storage
        .from("venue-photos")
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }

    lastError = error;
    const retryable = isRetryableSupabaseStorageError(error.message);
    if (!retryable || attempt === maxAttempts) break;
    // Short backoff — Supabase 5xx clears quickly. Jitter avoids
    // thundering-herd when a whole batch retries on the same tick.
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 200));
  }

  // Bubble up the *full* Supabase error so production logs show the
  // real cause ("Bucket not found", RLS policy error, mime rejection,
  // etc.) instead of a truncated "Bu..." that reveals nothing.
  console.error("[uploadVenuePhoto] Supabase storage upload failed", {
    bucket: "venue-photos",
    path,
    contentType,
    byteLength: file.byteLength,
    supabaseError: lastError,
  });
  throw new Error(
    `写真のアップロードに失敗しました (bucket=venue-photos, path=${path}): ${lastError?.message ?? "unknown"}`,
  );
}

/**
 * Upload a checklist photo to Supabase Storage.
 * Uses the same "venue-photos" bucket as venue photos.
 */
export async function uploadChecklistPhoto(
  file: Buffer,
  fileName: string,
  projectId: string,
  venueId: string,
): Promise<string> {
  const supabase = await getStorageClient();
  await ensureBucket(supabase, "venue-photos");
  const ext = fileName.split(".").pop() ?? "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${projectId}/${venueId}/checklist/${uniqueName}`;

  const { data, error } = await supabase.storage
    .from("venue-photos")
    .upload(path, file, {
      contentType: `image/${ext === "png" ? "png" : ext === "webp" ? "webp" : "jpeg"}`,
      upsert: false,
    });

  if (error) throw new Error(`写真のアップロードに失敗しました: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("venue-photos")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function downloadEstimatePdf(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`PDFのダウンロードに失敗しました: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract the storage key (path inside the bucket) from a public Supabase
 * estimates URL. Returns null when the input doesn't look like one — the
 * caller should fall back to passing the URL as-is.
 *
 * Supabase public URLs look like:
 *   https://<proj>.supabase.co/storage/v1/object/public/estimates/<projectId>/<venueId>/estimates/<file>
 * and signed URLs mirror the same path under `/sign/`. We only need the
 * part after the bucket name.
 */
export function estimatePathFromPublicUrl(publicUrl: string): string | null {
  const match = publicUrl.match(/\/object\/(?:public|sign)\/estimates\/(.+?)(?:\?|$)/);
  if (!match) return null;
  return match[1];
}

/**
 * Issue a short-lived signed URL for an estimates-bucket PDF.
 *
 * The estimates bucket is private, so public URLs won't resolve when Claude
 * fetches them via a document-block URL source. A signed URL is both the
 * simplest way to hand Anthropic a one-off read capability and the cheapest
 * for privacy — it expires, so a leaked link loses value quickly.
 *
 * Returns the original URL on unexpected failure rather than throwing so
 * the caller can still hand it to Claude — if the bucket is actually public
 * in some envs, the passthrough still works.
 */
export async function createEstimateSignedUrl(
  pdfUrl: string,
  expiresInSeconds: number = 300,
): Promise<string> {
  const path = estimatePathFromPublicUrl(pdfUrl);
  if (!path) return pdfUrl;
  const supabase = await getStorageClient();
  const { data, error } = await supabase.storage
    .from("estimates")
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    console.warn("[createEstimateSignedUrl] failed", {
      path,
      error: error?.message,
    });
    return pdfUrl;
  }
  return data.signedUrl;
}

/**
 * Result shape for `uploadVenuePhotoFromUrl` — callers use the discriminator
 * to aggregate success / per-reason failure counts without try/catch churn.
 *
 * `reason` is a small enum on purpose: the UI surfaces a per-host counter
 * ("403 x 3") and Sentry groups warnings by this field.
 */
export type PhotoUploadReason =
  | "403"
  | "timeout"
  | "invalid-ct"
  | "size-limit"
  | "network";

export type PhotoUploadResult =
  | { ok: true; url: string; srcUrl: string }
  | { ok: false; reason: PhotoUploadReason; srcUrl: string; detail?: string };

/**
 * UA strings for retry escalation. Desktop Chrome first (best hit rate on
 * zexy/hanayume), then mobile Safari as a fallback for CDNs that explicitly
 * allow mobile user agents (some sites relax hotlink checks for mobile).
 */
const UA_DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const UA_MOBILE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

interface AttemptOptions {
  userAgent: string;
  referer: string | null;
}

interface AttemptResult {
  ok: boolean;
  status?: number;
  reason?: PhotoUploadReason;
  buffer?: Buffer;
  extFromCt?: string;
  detail?: string;
}

/**
 * Single fetch attempt. Returns a structured result (never throws on
 * HTTP / timeout / body violations — those become typed failures).
 */
async function attemptDownload(
  srcUrl: string,
  opts: AttemptOptions,
): Promise<AttemptResult> {
  try {
    const response = await fetch(srcUrl, {
      headers: {
        "User-Agent": opts.userAgent,
        Accept:
          "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        // Sec-Fetch-* mirrors what a real browser sends when loading an
        // <img> cross-origin. Some CDNs gate on these.
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      // 403 is the most common hotlink rejection — map explicitly so the
      // retry ladder can skip or escalate meaningfully.
      return {
        ok: false,
        status: response.status,
        reason: response.status === 403 ? "403" : "network",
        detail: `status=${response.status}`,
      };
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const extFromCt =
      contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : contentType.includes("png")
          ? "png"
          : contentType.includes("webp")
            ? "webp"
            : contentType.includes("avif")
              ? "avif"
              : null;
    if (!extFromCt) {
      return {
        ok: false,
        reason: "invalid-ct",
        detail: `content-type=${contentType || "(empty)"}`,
      };
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        ok: false,
        reason: "network",
        detail: "no body reader",
      };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return {
          ok: false,
          reason: "size-limit",
          detail: `>${MAX_BYTES} bytes`,
        };
      }
      chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    return { ok: true, buffer, extFromCt };
  } catch (err) {
    // AbortSignal.timeout raises TimeoutError (or AbortError on older runtimes).
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      reason: isTimeout ? "timeout" : "network",
      detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  }
}

/**
 * Download an externally-hosted image (e.g. from Zexy / Wedding Park / etc.)
 * and re-upload it to the venue-photos bucket. Returns a Result type so the
 * caller can aggregate per-reason counters for UX + Sentry.
 *
 * Protections:
 *  - Content-Type must be image/jpeg|png|webp|avif (rejects HTML anti-hotlink pages)
 *  - Response body capped at 5 MB via streaming reader
 *  - 12-second timeout (upstream CDNs usually respond under 2s; slow hosts
 *    like Wedding Park take 5-8s on first hit)
 *  - Sends a plausible browser UA + Sec-Fetch-* + optional Referer so
 *    hotlink-protected image origins serve bytes instead of 403ing.
 *
 * Retry ladder (stops at first 2xx):
 *  1. desktop Chrome UA with Referer (origin of source page)
 *  2. desktop Chrome UA without Referer — some CDNs 403 on any Referer
 *  3. mobile Safari UA with Referer — different fingerprint for sites that
 *     allow mobile but block desktop scrapers.
 *
 * NEVER throws — failures are surfaced in `{ok:false, reason}` so the caller
 * can decide per URL whether to drop or retry with a different strategy.
 */
export async function uploadVenuePhotoFromUrl(
  srcUrl: string,
  projectId: string,
  venueId: string,
  referer?: string,
): Promise<PhotoUploadResult> {
  let parsed: URL;
  try {
    parsed = new URL(srcUrl);
  } catch {
    return { ok: false, reason: "network", srcUrl, detail: "invalid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      ok: false,
      reason: "network",
      srcUrl,
      detail: `unsupported protocol: ${parsed.protocol}`,
    };
  }

  const attempts: AttemptOptions[] = [
    { userAgent: UA_DESKTOP_CHROME, referer: referer ?? null },
    { userAgent: UA_DESKTOP_CHROME, referer: null },
    { userAgent: UA_MOBILE_SAFARI, referer: referer ?? null },
  ];

  let lastFailure: AttemptResult | null = null;
  for (const opts of attempts) {
    const attempt = await attemptDownload(srcUrl, opts);
    if (attempt.ok && attempt.buffer && attempt.extFromCt) {
      try {
        const fileName = `import.${attempt.extFromCt}`;
        const url = await uploadVenuePhoto(
          attempt.buffer,
          fileName,
          projectId,
          venueId,
        );
        return { ok: true, url, srcUrl };
      } catch (err) {
        // Supabase upload (not the external fetch) failed — classify as network
        // since the external CDN is fine.
        return {
          ok: false,
          reason: "network",
          srcUrl,
          detail:
            err instanceof Error
              ? `supabase: ${err.message}`
              : "supabase upload failed",
        };
      }
    }
    lastFailure = attempt;
    // Some failure modes are terminal — no point retrying.
    if (
      attempt.reason === "invalid-ct" ||
      attempt.reason === "size-limit"
    ) {
      break;
    }
  }

  return {
    ok: false,
    reason: lastFailure?.reason ?? "network",
    srcUrl,
    detail: lastFailure?.detail,
  };
}
