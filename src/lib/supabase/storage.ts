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
 * Download an externally-hosted image (e.g. from Zexy / Wedding Park / etc.)
 * and re-upload it to the venue-photos bucket. Returns the public Supabase URL.
 *
 * Protections:
 *  - Content-Type must be image/jpeg|png|webp|avif (rejects HTML anti-hotlink pages)
 *  - Response body capped at 5 MB via streaming reader
 *  - 8-second timeout (upstream CDNs usually respond under 2s)
 *  - Sends a plausible browser UA + optional Referer so hotlink-protected
 *    image origins (zexy.st.st-img.jp) serve bytes instead of 403ing.
 *
 * Throws on any validation failure so the caller can skip the URL and
 * continue with the rest of the batch.
 */
export async function uploadVenuePhotoFromUrl(
  srcUrl: string,
  projectId: string,
  venueId: string,
  referer?: string,
): Promise<string> {
  const parsed = new URL(srcUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported image protocol: ${parsed.protocol}`);
  }

  const response = await fetch(srcUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Image fetch non-2xx: ${response.status} for ${srcUrl}`);
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
    throw new Error(`Unsupported content-type: ${contentType}`);
  }

  const MAX_BYTES = 5 * 1024 * 1024;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Image response has no body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`Image too large: >${MAX_BYTES} bytes`);
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);

  // uploadVenuePhoto derives extension from fileName; pass a synthetic name
  // so the stored object has the correct extension regardless of src URL.
  const fileName = `import.${extFromCt}`;
  return uploadVenuePhoto(buffer, fileName, projectId, venueId);
}
