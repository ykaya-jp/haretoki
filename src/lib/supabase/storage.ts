import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
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
 * Upload a venue photo to Supabase Storage.
 *
 * NOTE: The "venue-photos" bucket must be created in the Supabase Dashboard.
 * Go to Storage → New Bucket → name: "venue-photos". Set it as public.
 */
export async function uploadVenuePhoto(
  file: Buffer,
  fileName: string,
  projectId: string,
  venueId: string,
): Promise<string> {
  const supabase = await createClient();
  const ext = fileName.split(".").pop() ?? "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${projectId}/${venueId}/${uniqueName}`;

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
  const supabase = await createClient();
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
