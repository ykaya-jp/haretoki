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

export function VenuePhotoGallery({ venueId, name, photoUrls }: Props) {
  const [uploading, setUploading] = useState(false);
  // Show photos straight from props. P6's optimistic append was removed
  // during the /venues/[id] cacheComponents regression triage — bring it
  // back once the root cause is identified.
  const displayPhotos = photoUrls;
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
        if (added > 0) {
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
