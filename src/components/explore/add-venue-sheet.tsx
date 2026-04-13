"use client";

import { useState, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, ImagePlus, X } from "lucide-react";
import { addVenueFromUrl, confirmVenueFromUrl, createVenue, uploadVenuePhotos } from "@/server/actions/venues";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ExtractedVenueData {
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  estimatedPrice: number | null;
  features: string[];
  photoUrls: string[];
  confidence: "high" | "medium" | "low";
}

export function AddVenueSheet() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("url");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedVenueData | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const result = await addVenueFromUrl(url);
      if (result.error) {
        toast.error(result.error);
        setTab("manual");
      } else if (result.extracted) {
        setExtracted(result.extracted);
      }
    } catch {
      toast.error("追加できませんでした");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!extracted) return;
    setLoading(true);
    try {
      const result = await confirmVenueFromUrl(extracted, url);
      if (result.success) {
        toast.success("式場を追加しました");
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch {
      toast.error("追加できませんでした");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newFiles = [...photoFiles, ...files].slice(0, 10);
    setPhotoFiles(newFiles);

    // Generate preview URLs
    const previews = newFiles.map(f => URL.createObjectURL(f));
    // Revoke old previews
    for (const old of photoPreviews) URL.revokeObjectURL(old);
    setPhotoPreviews(previews);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleManualSubmit = async () => {
    if (!manualName.trim()) return;
    setLoading(true);
    try {
      // Upload photos first if any
      let photoUrls = uploadedPhotoUrls;
      if (photoFiles.length > 0 && uploadedPhotoUrls.length === 0) {
        const formData = new FormData();
        for (const file of photoFiles) {
          formData.append("photos", file);
        }
        const uploadResult = await uploadVenuePhotos(formData);
        if (uploadResult.success && uploadResult.urls) {
          photoUrls = uploadResult.urls;
          setUploadedPhotoUrls(uploadResult.urls);
        }
      }

      const result = await createVenue({
        name: manualName,
        location: manualLocation || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });
      if (result.success) {
        toast.success("式場を追加しました");
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        toast.error("追加できませんでした");
      }
    } catch {
      toast.error("追加できませんでした");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUrl("");
    setExtracted(null);
    setManualName("");
    setManualLocation("");
    setPhotoFiles([]);
    for (const preview of photoPreviews) URL.revokeObjectURL(preview);
    setPhotoPreviews([]);
    setUploadedPhotoUrls([]);
    setTab("url");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button size="sm" className="gap-1" />}>
        <Plus className="h-4 w-4" />
        追加
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>新しい式場を追加</SheetTitle>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1">URLで追加</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">自分で入力</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 pt-4">
            {!extracted ? (
              <>
                <div className="space-y-2">
                  <Label>式場ページのURLを貼り付け</Label>
                  <div className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      type="url"
                    />
                    <Button onClick={handleUrlSubmit} disabled={loading || !url.trim()}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "読み取る"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ゼクシィ・ハナユメ・Wedding Park等に対応
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">読み取った情報</p>
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="font-serif font-medium">{extracted.name}</p>
                  {extracted.location && (
                    <p className="text-sm text-muted-foreground">{extracted.location}</p>
                  )}
                  {extracted.accessInfo && (
                    <p className="text-sm text-muted-foreground">{extracted.accessInfo}</p>
                  )}
                  {(extracted.capacityMin || extracted.capacityMax) && (
                    <p className="text-sm text-muted-foreground">
                      着席{extracted.capacityMin}〜{extracted.capacityMax}名
                    </p>
                  )}
                  {extracted.ceremonyStyles.length > 0 && (
                    <div className="flex gap-1">
                      {extracted.ceremonyStyles.map((s) => (
                        <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    読み取り精度: {extracted.confidence === "high" ? "高い" : extracted.confidence === "medium" ? "ふつう" : "低い"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">あとから編集できます</p>
                <div className="flex gap-2">
                  <Button onClick={handleConfirm} disabled={loading} className="flex-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "この内容で追加"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setExtracted(null); setTab("manual"); }}
                    className="flex-1"
                  >
                    修正して追加
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="venue-name">式場のお名前 *</Label>
              <Input
                id="venue-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="アニヴェルセル表参道"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-location">エリア</Label>
              <Input
                id="venue-location"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                placeholder="表参道"
              />
            </div>

            {/* Photo upload */}
            <div className="space-y-2">
              <Label>写真</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
              {photoPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`写真 ${i + 1}`}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm"
                        aria-label="削除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={photoFiles.length >= 10}
                className="gap-1"
              >
                <ImagePlus className="h-4 w-4" />
                {photoFiles.length > 0 ? `${photoFiles.length}/10枚` : "写真を選ぶ"}
              </Button>
            </div>

            <Button onClick={handleManualSubmit} disabled={loading || !manualName.trim()} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "この式場を追加"}
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
