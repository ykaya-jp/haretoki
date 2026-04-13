"use client";

import { createClient } from "@/lib/supabase/client";

async function resizeImage(file: File, maxSize: number = 2048): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Blob creation failed"));
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadVisitPhoto(
  file: File,
  projectId: string,
  venueId: string,
  visitId: string
): Promise<string> {
  const supabase = createClient();
  const resized = await resizeImage(file);
  const fileName = `${crypto.randomUUID()}.jpg`;
  const path = `${projectId}/${venueId}/${visitId}/${fileName}`;

  const { error } = await supabase.storage
    .from("visit-photos")
    .upload(path, resized, { contentType: "image/jpeg" });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from("visit-photos")
    .getPublicUrl(path);

  return data.publicUrl;
}
