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

export async function downloadEstimatePdf(pdfUrl: string): Promise<Buffer> {
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`PDFのダウンロードに失敗しました: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
