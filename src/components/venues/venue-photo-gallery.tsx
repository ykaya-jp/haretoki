"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { uploadVenuePhotos } from "@/server/actions/venues";
import { PhotoCarousel } from "@/components/venues/photo-carousel";

interface Props {
  venueId: string;
  name: string;
  photoUrls: string[];
}

/** Stable signature for a URL list — drives the render-phase reset below
 *  so we only stomp on optimistic state when the server truly changes. */
function photoSignature(urls: string[]): string {
  return urls.join("|");
}

export function VenuePhotoGallery({ venueId, name, photoUrls }: Props) {
  const [uploading, setUploading] = useState(false);
  // Optimistic display list: mirror server photoUrls, append freshly uploaded
  // URLs immediately so the user sees the result before router.refresh()
  // roundtrips the server component. Sync-from-props happens render-phase
  // (React 19 pattern) — useEffect would trigger the set-state-in-effect
  // ESLint rule and waste a render.
  const [displayPhotos, setDisplayPhotos] = useState<string[]>(photoUrls);
  const [propsSig, setPropsSig] = useState(() => photoSignature(photoUrls));
  const nextSig = photoSignature(photoUrls);
  if (propsSig !== nextSig) {
    setPropsSig(nextSig);
    setDisplayPhotos(photoUrls);
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const triggerPicker = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (files.length > 10) {
      toast.error("一度にアップロードできるのは10枚までです");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("photos", f));
      const result = await uploadVenuePhotos(venueId, formData);
      if (result.success) {
        const added = result.urls?.length ?? 0;
        if (added > 0 && result.urls) {
          const freshUrls = result.urls;
          setDisplayPhotos((prev) => {
            const seen = new Set(prev);
            return [...prev, ...freshUrls.filter((u) => !seen.has(u))];
          });
          toast.success(`${added}枚の写真を追加しました`);
        }
        if ((result.droppedCount ?? 0) > 0) {
          toast.info(`${result.droppedCount}件はサイズ/形式が合わず追加できませんでした`);
        }
        router.refresh();
      } else {
        toast.error(result.error ?? "アップロードできませんでした");
      }
    } catch {
      toast.error("アップロードできませんでした");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasPhotos = displayPhotos.length > 0;

  return (
    <div className="space-y-3">
      <PhotoCarousel
        photos={displayPhotos}
        alt={name}
        aspectRatio="4/3"
        onAddPhotoClick={hasPhotos ? undefined : triggerPicker}
      />

      {hasPhotos && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={triggerPicker}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-95 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {uploading ? "アップロード中..." : "写真を追加"}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />
    </div>
  );
}
