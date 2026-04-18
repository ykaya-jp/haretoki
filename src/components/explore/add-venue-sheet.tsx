"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, ImagePlus, X, ChevronRight } from "lucide-react";
import { addVenueFromUrl, confirmVenueFromUrl, createVenue, uploadVenuePhotos } from "@/server/actions/venues";
import { showToast } from "@/lib/toast";
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

/** Per-URL processing state for skeleton fill animation */
interface UrlProcessState {
  url: string;
  status: "pending" | "loading" | "success" | "error";
  extracted?: ExtractedVenueData;
  error?: string;
  /** Which fields have resolved so far — used for progressive fill */
  filledFields: ("name" | "location" | "access" | "photo")[];
}

interface AddVenueSheetProps {
  defaultOpen?: boolean;
  /** Controlled open state. When provided, the internal state is ignored. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddVenueSheet({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddVenueSheetProps = {}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  // URL textarea
  const [urlInput, setUrlInput] = useState("");
  const [urlStates, setUrlStates] = useState<UrlProcessState[]>([]);
  const [urlLoading, setUrlLoading] = useState(false);

  // Manual form collapse state
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  /** Parse the textarea into trimmed, non-empty URL strings */
  const parseUrls = (raw: string): string[] =>
    raw
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

  /** Simulate progressive field fill with timed reveals */
  const animateFill = (
    index: number,
    fields: ("name" | "location" | "access" | "photo")[],
    delay = 200
  ) => {
    fields.forEach((field, i) => {
      setTimeout(() => {
        setUrlStates((prev) =>
          prev.map((s, si) =>
            si === index
              ? { ...s, filledFields: [...s.filledFields, field] }
              : s
          )
        );
      }, delay * (i + 1));
    });
  };

  const handleUrlSubmit = async () => {
    const urls = parseUrls(urlInput);
    if (urls.length === 0) return;

    const MAX = 10;
    const processing = urls.slice(0, MAX);
    const skipped = urls.slice(MAX);

    // Init skeleton states
    const initial: UrlProcessState[] = processing.map((url) => ({
      url,
      status: "loading",
      filledFields: [],
    }));
    setUrlStates(initial);
    setUrlLoading(true);

    // Parallel processing with Promise.allSettled
    const results = await Promise.allSettled(
      processing.map(async (url, index) => {
        try {
          const extractResult = await addVenueFromUrl(url);
          if (extractResult.error || !extractResult.extracted) {
            setUrlStates((prev) =>
              prev.map((s, i) =>
                i === index
                  ? { ...s, status: "error", error: extractResult.error ?? "読み取りに失敗" }
                  : s
              )
            );
            return { index, success: false };
          }

          const extracted = extractResult.extracted;

          // Animate fields progressively
          const fieldsToFill: ("name" | "location" | "access" | "photo")[] = ["name"];
          if (extracted.location) fieldsToFill.push("location");
          if (extracted.accessInfo) fieldsToFill.push("access");
          if (extracted.photoUrls.length > 0) fieldsToFill.push("photo");

          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, extracted, filledFields: [] } : s
            )
          );
          animateFill(index, fieldsToFill);

          // Wait for animation then confirm
          await new Promise((r) => setTimeout(r, fieldsToFill.length * 200 + 100));

          const confirmResult = await confirmVenueFromUrl(extracted, url);
          if (!confirmResult.success) {
            setUrlStates((prev) =>
              prev.map((s, i) =>
                i === index ? { ...s, status: "error", error: "登録に失敗" } : s
              )
            );
            return { index, success: false };
          }

          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, status: "success" } : s
            )
          );
          return { index, success: true, name: extracted.name, venueId: confirmResult.venue.id };
        } catch {
          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, status: "error", error: "予期しないエラー" } : s
            )
          );
          return { index, success: false };
        }
      })
    );

    setUrlLoading(false);

    const successResults = results.filter(
      (r): r is PromiseFulfilledResult<{ index: number; success: true; name: string; venueId: string }> =>
        r.status === "fulfilled" && r.value.success
    );
    const successCount = successResults.length;
    const failCount = processing.length - successCount;

    if (successCount > 0) {
      if (failCount === 0) {
        showToast("success", `${successCount}件の式場を追加しました`);
      } else {
        showToast("success", `${successCount}件追加、${failCount}件失敗`);
      }
      // Navigate to the new venue page when exactly one URL succeeded
      if (successCount === 1 && successResults[0].value.venueId) {
        router.push(`/venues/${successResults[0].value.venueId}`);
      } else {
        router.refresh();
      }
    } else if (failCount > 0) {
      showToast("error", "URLから読み取れませんでした");
    }

    if (skipped.length > 0) {
      showToast("info", `11件目以降 ${skipped.length} 件はスキップされました`);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newFiles = [...photoFiles, ...files].slice(0, 10);
    setPhotoFiles(newFiles);
    const previews = newFiles.map((f) => URL.createObjectURL(f));
    for (const old of photoPreviews) URL.revokeObjectURL(old);
    setPhotoPreviews(previews);
    setUploadedPhotoUrls([]);
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    setUploadedPhotoUrls([]);
  };

  const handleManualSubmit = async () => {
    if (!manualName.trim()) return;
    setManualLoading(true);
    try {
      let photoUrls = uploadedPhotoUrls;
      if (photoFiles.length > 0 && uploadedPhotoUrls.length === 0) {
        const formData = new FormData();
        for (const file of photoFiles) formData.append("photos", file);
        const uploadResult = await uploadVenuePhotos(formData);
        if (uploadResult.success && uploadResult.urls) {
          photoUrls = uploadResult.urls;
          setUploadedPhotoUrls(uploadResult.urls);
          if ((uploadResult.droppedCount ?? 0) > 0) {
            showToast("info", `${uploadResult.droppedCount}件はサイズ/形式が合わず追加できませんでした`);
          }
        }
      }

      const result = await createVenue({
        name: manualName,
        location: manualLocation || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });

      if (result.success) {
        showToast("success", "式場を追加しました");
        setOpen(false);
        resetForm();
        router.refresh();
      } else {
        showToast("error", "うまく追加できませんでした");
      }
    } catch {
      showToast("error", "うまく追加できませんでした");
    } finally {
      setManualLoading(false);
    }
  };

  const resetForm = () => {
    setUrlInput("");
    setUrlStates([]);
    setUrlLoading(false);
    setManualOpen(false);
    setManualName("");
    setManualLocation("");
    setPhotoFiles([]);
    for (const preview of photoPreviews) URL.revokeObjectURL(preview);
    setPhotoPreviews([]);
    setUploadedPhotoUrls([]);
  };

  const allDone =
    urlStates.length > 0 &&
    urlStates.every((s) => s.status === "success" || s.status === "error");

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        setOpen(v);
      }}
    >
      {controlledOpen === undefined && (
        <Button
          size="sm"
          className="gap-1"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
          追加
        </Button>
      )}
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[92dvh] overflow-y-auto">
        {/* Editorial header — eyebrow + 明朝 title */}
        <SheetHeader className="px-1 pt-1 pb-2 mb-1">
          <p className="text-eyebrow text-muted-foreground text-left">
            HARETOKI · Venue
          </p>
          <SheetTitle className="mt-2 font-[family-name:var(--font-display)] text-[19px] font-extralight tracking-[0.01em] text-foreground text-left leading-[1.35]">
            新しい式場を、迎える
          </SheetTitle>
          <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
            URL を貼るだけ
          </p>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          {/* ── Primary: URL input — the hero of this sheet ── */}
          <div className="space-y-3">
            <div
              className="rounded-2xl p-0.5"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 20%, transparent) 0%, color-mix(in oklab, var(--primary) 10%, transparent) 100%)",
              }}
            >
              <textarea
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={"式場の URL を貼ってください\n(複数可 · 改行で区切り)"}
                rows={4}
                disabled={urlLoading}
                className="w-full rounded-[14px] border-0 bg-card px-4 py-4 text-[15px] placeholder:text-muted-foreground/50 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
                style={{ minHeight: 112 }}
              />
            </div>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              ゼクシィ・ハナユメ・Wedding Park 等に対応しています
            </p>
            <Button
              onClick={handleUrlSubmit}
              disabled={urlLoading || parseUrls(urlInput).length === 0}
              className="w-full h-12 rounded-[14px] text-[14.5px] font-medium tracking-wide bg-[var(--gold-warm)] hover:bg-[var(--gold-warm)]/90 text-white active:scale-[0.98] transition-transform"
              style={{
                boxShadow:
                  "0 1px 2px rgba(42,35,32,0.06), 0 8px 24px color-mix(in oklab, var(--gold-warm) 22%, transparent)",
              }}
            >
              {urlLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  読み込んでいます…
                </>
              ) : (
                "URL から取り込む"
              )}
            </Button>
          </div>

          {/* ── E-5: Progressive skeleton fill cards ── */}
          <AnimatePresence>
            {urlStates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                {urlStates.map((state, i) => (
                  <UrlSkeletonCard key={i} state={state} onManualFallback={() => setManualOpen(true)} />
                ))}

                {allDone && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="flex justify-center pt-2"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUrlStates([]);
                        setUrlInput("");
                      }}
                    >
                      別のURLを追加する
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Secondary: Collapsible manual form ── */}
          <div
            className="pt-4"
            style={{
              borderTop:
                "1px solid color-mix(in oklab, var(--gold-warm) 25%, transparent)",
              borderImage:
                "linear-gradient(to right, transparent, color-mix(in oklab, var(--gold-warm) 35%, transparent), transparent) 1",
            }}
          >
            <button
              type="button"
              onClick={() => setManualOpen((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] text-muted-foreground active:text-foreground transition-colors py-1.5"
            >
              URL がない場合は
              <span className="font-medium text-foreground">手動で入力する</span>
              <ChevronRight
                className={`h-4 w-4 text-foreground transition-transform duration-200 ${manualOpen ? "rotate-90" : ""}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {manualOpen && (
                <motion.div
                  key="manual-form"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!manualLoading && manualName.trim()) handleManualSubmit();
                    }}
                    className="space-y-4 pt-4"
                  >
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
                                className="group absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-foreground shadow-sm active:scale-95 transition before:absolute before:inset-[-12px] before:content-['']"
                                aria-label="写真を外す"
                              >
                                <X className="h-3 w-3" strokeWidth={2} />
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

                    <Button
                      type="submit"
                      disabled={manualLoading || !manualName.trim()}
                      className="w-full h-11"
                    >
                      {manualLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "手動で追加する"
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Sub-component: per-URL skeleton card ──────────────────────────────────────

interface UrlSkeletonCardProps {
  state: UrlProcessState;
  onManualFallback: () => void;
}

function UrlSkeletonCard({ state, onManualFallback }: UrlSkeletonCardProps) {
  const { status, extracted, filledFields, error, url } = state;
  const isLoading = status === "loading" && !extracted;

  if (status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm"
      >
        <p className="text-muted-foreground">
          自動で読めませんでした。{" "}
          <button
            type="button"
            onClick={onManualFallback}
            className="font-medium text-foreground underline underline-offset-4"
          >
            手動で入力する →
          </button>
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          URLの形式を確認するか、式場名を直接入力してください。
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1 truncate">{url}</p>
        {error && <p className="text-xs text-destructive/70 mt-0.5">{error}</p>}
      </motion.div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Photo area skeleton / fill */}
      <div className="aspect-[4/3] w-full relative bg-muted/40">
        {isLoading && <Skeleton className="absolute inset-0 rounded-none" />}
        {extracted && filledFields.includes("photo") && extracted.photoUrls[0] && (
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            src={extracted.photoUrls[0]}
            alt={extracted.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {extracted && !filledFields.includes("photo") && (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}

        {/* Success badge — ブランド gold で「収まりました」の到着感 */}
        {status === "success" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2 right-2 rounded-full bg-[var(--gold-subtle)] text-[var(--gold-warm)] text-[11px] px-2.5 py-0.5 tracking-[0.08em] backdrop-blur-sm"
            style={{
              border:
                "1px solid color-mix(in oklab, var(--gold-warm) 45%, transparent)",
            }}
          >
            収まりました
          </motion.div>
        )}
      </div>

      {/* Text fields */}
      <div className="p-3 space-y-1.5">
        {/* Venue name */}
        <div className="h-5">
          {isLoading && <Skeleton className="h-4 w-40" />}
          {extracted && (
            <AnimatePresence>
              {filledFields.includes("name") ? (
                <motion.p
                  key="name"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-[family-name:var(--font-display)] text-sm font-normal truncate"
                >
                  {extracted.name}
                </motion.p>
              ) : (
                <Skeleton className="h-4 w-40" />
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Location */}
        <div className="h-4">
          {isLoading && <Skeleton className="h-3 w-28" />}
          {extracted && (
            <AnimatePresence>
              {filledFields.includes("location") ? (
                <motion.p
                  key="location"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground truncate"
                >
                  {extracted.location}
                </motion.p>
              ) : (
                <Skeleton className="h-3 w-28" />
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Access */}
        <div className="h-4">
          {isLoading && <Skeleton className="h-3 w-36" />}
          {extracted && (
            <AnimatePresence>
              {filledFields.includes("access") ? (
                <motion.p
                  key="access"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-muted-foreground truncate"
                >
                  {extracted.accessInfo}
                </motion.p>
              ) : (
                <Skeleton className="h-3 w-36" />
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
