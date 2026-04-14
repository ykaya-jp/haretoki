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

/**
 * Unified photo gallery for venue detail page.
 * - Shows PhotoCarousel when photos exist
 * - Shows tappable drop-zone when empty
 * - Provides persistent "写真を追加" primary button below
 * - Single file input shared between all triggers
 */
export function VenuePhotoGallery({ venueId, name, photoUrls }: Props) {
  const [uploading, setUploading] = useState(false);
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
        toast.success(`${files.length}枚の写真を追加しました`);
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

  const hasPhotos = photoUrls.length > 0;

  return (
    <div className="space-y-3">
      <PhotoCarousel
        photos={photoUrls}
        alt={name}
        aspectRatio="4/3"
        onAddPhotoClick={hasPhotos ? undefined : triggerPicker}
      />

      {/* Persistent upload button when photos exist */}
      {hasPhotos && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={triggerPicker}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-subtle)] px-4 py-2 text-xs font-medium text-[var(--gold-warm)] transition-all duration-200 hover:bg-[var(--gold-warm)]/20 active:scale-95 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
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
