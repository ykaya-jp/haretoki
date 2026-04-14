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

interface AddVenueSheetProps {
  defaultOpen?: boolean;
}

export function AddVenueSheet({ defaultOpen = false }: AddVenueSheetProps = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [tab, setTab] = useState<"manual" | "url" | "bulk">("manual");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedVenueData | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkResults, setBulkResults] = useState<Array<{ url: string; success: boolean; venueName?: string; error?: string }> | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleBulkSubmit = async () => {
    const allUrls = bulkUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (allUrls.length === 0) return;

    const MAX = 10;
    const processing = allUrls.slice(0, MAX);
    const skipped = allUrls.slice(MAX);

    setLoading(true);
    setBulkResults([]);
    setBulkProgress({ done: 0, total: processing.length });

    // Sequential calls so the UI can reflect progress per URL.
    // (Server Actions can't stream; a bounded concurrency=3 path also exists on the server
    //  for programmatic callers, but here we favour visible feedback over throughput.)
    const accumulated: Array<{ url: string; success: boolean; venueName?: string; error?: string }> = [];
    try {
      for (let i = 0; i < processing.length; i++) {
        const singleUrl = processing[i];
        try {
          const extractResult = await addVenueFromUrl(singleUrl);
          if (extractResult.error || !extractResult.extracted) {
            accumulated.push({ url: singleUrl, success: false, error: extractResult.error ?? "読み取りに失敗" });
          } else {
            const confirmResult = await confirmVenueFromUrl(extractResult.extracted, singleUrl);
            if (!confirmResult.success) {
              accumulated.push({ url: singleUrl, success: false, error: "登録に失敗" });
            } else {
              accumulated.push({ url: singleUrl, success: true, venueName: extractResult.extracted.name });
            }
          }
        } catch {
          accumulated.push({ url: singleUrl, success: false, error: "予期しないエラー" });
        }
        setBulkResults([...accumulated]);
        setBulkProgress({ done: i + 1, total: processing.length });
      }

      const successCount = accumulated.filter((r) => r.success).length;
      if (successCount > 0) {
        toast.success(`${successCount}件の式場を追加しました`);
        router.refresh();
      }
      if (skipped.length > 0) {
        toast.info(`11件目以降 ${skipped.length} 件は取り込みをスキップしました。分けて追加してください`);
      }
    } catch {
      toast.error("一括取り込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const result = await addVenueFromUrl(url);
      if (result.error) {
        // Prefer the server-provided specific cause (HTTP status, timeout,
        // JS-required page, etc.) so the user knows what actually went wrong.
        toast.info(result.error || "URLから取得できませんでした。手入力に切り替えました");
        setTab("manual");
      } else if (result.extracted) {
        setExtracted(result.extracted);
        if (result.warning) {
          // OGP-only extraction path (SPA sites like Zexy). Tell the user to review.
          toast.info(result.warning);
        }
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
    // Invalidate any prior upload cache so retry uploads ALL current files.
    // (Previous logic skipped re-upload once uploadedPhotoUrls was non-empty,
    //  silently dropping files added after a failed submit.)
    setUploadedPhotoUrls([]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setUploadedPhotoUrls([]);
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
          if ((uploadResult.droppedCount ?? 0) > 0) {
            toast.info(`${uploadResult.droppedCount}件はサイズ/形式が合わず追加できませんでした`);
          }
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
    setTab("manual");
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
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "manual" | "url" | "bulk")}
          className="mt-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="manual" className="flex-1">自分で</TabsTrigger>
            <TabsTrigger value="url" className="flex-1">URL</TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1">まとめて</TabsTrigger>
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

          <TabsContent value="bulk" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>URLを改行区切りで入力（最大10件）</Label>
              <textarea
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                placeholder="https://www.zexy.net/...&#10;https://www.hanayume.com/...&#10;https://www.weddingpark.net/..."
                rows={6}
                className="w-full rounded-lg border border-border bg-card p-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground">
                ゼクシィ・ハナユメ・Wedding Park 等のURLを貼り付けてください
              </p>
            </div>
            <Button
              onClick={handleBulkSubmit}
              disabled={loading || bulkUrls.trim().length === 0}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {bulkProgress
                    ? `読み取り中 ${bulkProgress.done} / ${bulkProgress.total}`
                    : "読み取り中..."}
                </>
              ) : (
                "まとめて追加"
              )}
            </Button>
            {bulkResults && (
              <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">取り込み結果</p>
                {bulkResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={r.success ? "text-green-600" : "text-destructive"}>
                      {r.success ? "✓" : "✗"}
                    </span>
                    <span className="flex-1 truncate">
                      {r.success ? r.venueName : r.url}
                    </span>
                    {!r.success && <span className="text-muted-foreground">{r.error}</span>}
                  </div>
                ))}
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
