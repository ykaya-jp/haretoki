"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { uploadVenuePhotos } from "@/server/actions/venues";

export function AddPhotosButton({ venueId }: { venueId: string }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground transition-all duration-200 hover:text-foreground hover:border-foreground/30 active:scale-95 disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {uploading ? "アップロード中..." : "写真を追加"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />
    </>
  );
}
