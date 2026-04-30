"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, ImagePlus, X, ChevronRight, Sparkles, Layers } from "lucide-react";
import { addVenueFromUrl, confirmVenueFromUrl, createVenue, uploadVenuePhotos } from "@/server/actions/venues";
import { showToast } from "@/lib/toast";
import { parseBulkUrls, BULK_URL_LIMIT } from "@/lib/url-bulk-parse";
import { useRouter } from "next/navigation";
import { VenueNameSearch } from "@/components/explore/venue-name-search";
import type { VenueSearchHit } from "@/lib/venue-search/types";
import { resolveVenueSearchHitUrl } from "@/server/actions/venue-search-resolve";

interface ExtractedIndividualReview {
  title: string | null;
  body: string;
  rating: number | null;
  author: string | null;
  visitedAt: string | null;
}

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
  costMin: number | null;
  costMax: number | null;
  paymentMethodEnums: ("credit_card" | "cash" | "bank_transfer" | "installment")[];
  dressBringIn: "allowed" | "not_allowed" | "negotiable" | null;
  dressBringInFee: number | null;
  maxInstallments: number | null;
  vibeTags: string[];
  reviews: ExtractedIndividualReview[];
}

/**
 * Stage of the URL-import pipeline. Used for the caption under the
 * skeleton card so the user sees *why* the import is still working
 * (otherwise 15s of review summary feels like a hang).
 *
 *   extract  — fetching + parsing metadata
 *   reviews  — saving individual review rows to DB
 *   summary  — asking Claude to produce the venue-level summary
 */
type ImportStage = "extract" | "reviews" | "summary";

const STAGE_CAPTIONS: Record<ImportStage, string> = {
  extract: "ページから情報を読み取っています…",
  reviews: "口コミを読み込んでいます…",
  summary: "AI がまとめを作っています…",
};

/** Mirror of server-side ReviewSummaryStatus. Kept inline to avoid a client bundle pull of server types. */
type ReviewSummaryStatus = "completed" | "timeout" | "skipped" | "failed";

/** Per-URL processing state for skeleton fill animation */
interface UrlProcessState {
  url: string;
  status: "pending" | "loading" | "success" | "error";
  /** Where we are inside the pipeline while status === "loading". */
  stage?: ImportStage;
  extracted?: ExtractedVenueData;
  error?: string;
  /** Which fields have resolved so far — used for progressive fill */
  filledFields: ("name" | "location" | "access" | "photo")[];
  /** Dedupe outcome — present once confirm completes */
  mode?: "created" | "merged";
  updatedFields?: string[];
  venueId?: string;
  /** When merged, the existing venue's name for the merged-card header */
  existingName?: string;
  /** True while a re-run with forceNew is in flight (escape hatch). */
  forcingNew?: boolean;
  /** How the review summary finished. Used for post-import toast copy. */
  reviewSummaryStatus?: ReviewSummaryStatus;
  /** Number of individual reviews saved during this import. */
  individualReviewCount?: number;
}

/** Japanese labels for updatedFields chips in the merged card. */
const FIELD_LABELS: Record<string, string> = {
  location: "住所",
  accessInfo: "アクセス",
  postalCode: "郵便番号",
  streetAddress: "番地",
  latitude: "位置情報",
  longitude: "位置情報",
  phoneNumber: "電話番号",
  hasParking: "駐車場",
  parkingCapacity: "駐車台数",
  hasShuttle: "送迎",
  hasAccommodation: "提携宿泊",
  acceptsSecondParty: "二次会",
  barrierFree: "バリアフリー",
  ceremonyFeeExact: "挙式料",
  productionFeeMin: "演出費",
  productionFeeMax: "演出費",
  serviceFeeRate: "サービス料",
  operatingHours: "営業時間",
  closedDays: "定休日",
  cuisineTypes: "料理",
  chefCredentials: "シェフ",
  dressBringIn: "ドレス持込",
  dressBringInFee: "持込料",
  maxInstallments: "分割払い",
  ceremonyStyles: "挙式スタイル",
  paymentMethodEnums: "支払い方法",
  vibeTags: "雰囲気",
  sourceUrls: "参照URL",
  photoUrls: "写真",
  costMin: "費用",
  costMax: "費用",
  capacityMin: "収容人数",
  capacityMax: "収容人数",
  externalRatingValue: "評価",
  externalReviewCount: "口コミ件数",
};

/** Collapse updatedFields into deduped human-readable labels. */
function dedupeFieldLabels(fields: string[]): string[] {
  const out = new Set<string>();
  for (const f of fields) {
    const label = FIELD_LABELS[f];
    if (label) out.add(label);
  }
  return Array.from(out);
}

/**
 * Build the review-summary half of the success toast message. Kept
 * separate so the toast copy stays co-located with the `ReviewSummaryStatus`
 * variants and is easy to tweak.
 *
 *   completed → "口コミ N 件を取り込み、まとめを保存しました"
 *   timeout   → "口コミは取り込みましたが、まとめは後ほど『AI 要約を再生成』ボタンで作成できます"
 *   skipped   → null (no review mention — the venue-added line stands alone)
 *   failed    → "口コミは取り込めましたが、まとめはまだ作れていません"
 */
function buildReviewSummaryToastLine(
  status: ReviewSummaryStatus | undefined,
  reviewCount: number | undefined,
): string | null {
  if (!status || status === "skipped") return null;
  if (status === "completed") {
    const n = reviewCount ?? 0;
    if (n === 0) return "口コミのまとめを保存しました";
    return `✨ 口コミ ${n} 件を取り込み、まとめを保存しました`;
  }
  if (status === "timeout") {
    return "口コミは取り込みましたが、まとめは後ほど『AI 要約を再生成』ボタンで作成できます";
  }
  // "failed" — reviews saved (maybe), summary not. Don't blame the user.
  return "口コミは取り込めましたが、まとめはまだ作れていません";
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
  // Running counter for sequential bulk processing: "N / M 完了" caption.
  // null when not currently processing.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );

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

  /**
   * Parse the textarea into http(s) URLs.
   * Delegates to the shared, unit-tested parseBulkUrls so the preview chip,
   * submit gate, and tests all agree on what counts as a URL.
   */
  const parsedUrls = parseBulkUrls(urlInput);
  const overLimit = parsedUrls.length > BULK_URL_LIMIT;

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
    if (parsedUrls.length === 0) return;
    // The submit button is disabled past the limit, but guard anyway —
    // this keeps the invariant "we never dispatch more than BULK_URL_LIMIT
    // requests per submit" testable from a single place.
    if (overLimit) {
      showToast("error", `1回に取り込めるのは ${BULK_URL_LIMIT} 件までです`);
      return;
    }

    const processing = parsedUrls;

    // Init skeleton states — all rows start pending; the current row
    // flips to "loading" as the sequential loop reaches it.
    const initial: UrlProcessState[] = processing.map((url) => ({
      url,
      status: "pending",
      filledFields: [],
    }));
    setUrlStates(initial);
    setUrlLoading(true);
    setProgress({ done: 0, total: processing.length });

    type UrlSubmitResult =
      | {
          index: number;
          success: true;
          name: string;
          venueId: string;
          mode: "created" | "merged";
          updatedFieldsCount: number;
          photoUploadedCount: number;
          photoRequestedCount: number;
          reviewSummaryStatus: ReviewSummaryStatus | undefined;
          individualReviewCount: number | undefined;
        }
      | { index: number; success: false };

    const results: UrlSubmitResult[] = [];

    // Sequential for-await. Parallel would hammer per-domain CDN
    // rate-limits (ゼクシィ / ハナユメ / みんなのウェディング) and
    // multiplies the Claude summary cost. We trade wall-clock for
    // stability + predictable spend. Each URL still fails independently —
    // we never bail the whole batch on one failure.
    for (let index = 0; index < processing.length; index++) {
      const url = processing[index];
      // Mark this row active.
      setUrlStates((prev) =>
        prev.map((s, i) =>
          i === index ? { ...s, status: "loading", stage: "extract" } : s,
        ),
      );

      try {
        const extractResult = await addVenueFromUrl(url);
        if (extractResult.error || !extractResult.extracted) {
          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index
                ? { ...s, status: "error", error: extractResult.error ?? "読み取りに失敗" }
                : s,
            ),
          );
          results.push({ index, success: false });
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
          continue;
        }

        const extracted = extractResult.extracted;

        // Animate fields progressively
        const fieldsToFill: ("name" | "location" | "access" | "photo")[] = ["name"];
        if (extracted.location) fieldsToFill.push("location");
        if (extracted.accessInfo) fieldsToFill.push("access");
        if (extracted.photoUrls.length > 0) fieldsToFill.push("photo");

        setUrlStates((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, extracted, filledFields: [] } : s,
          ),
        );
        animateFill(index, fieldsToFill);

        // Wait for animation then confirm
        await new Promise((r) => setTimeout(r, fieldsToFill.length * 200 + 100));

        const hasExtractedReviews = extracted.reviews.length > 0;
        if (hasExtractedReviews) {
          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, stage: "reviews" } : s,
            ),
          );
          await new Promise((r) => setTimeout(r, 350));
          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, stage: "summary" } : s,
            ),
          );
        }

        const confirmResult = await confirmVenueFromUrl(extracted, url);
        if (!confirmResult.success) {
          setUrlStates((prev) =>
            prev.map((s, i) =>
              i === index ? { ...s, status: "error", error: "登録に失敗" } : s,
            ),
          );
          results.push({ index, success: false });
          setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
          continue;
        }

        const mode = confirmResult.mode;
        const updatedFields = confirmResult.updatedFields ?? [];
        const venueId = confirmResult.venue.id;
        const existingName =
          mode === "merged" ? confirmResult.venue.name : undefined;
        const photoUploadedCount = confirmResult.photoUploadedCount ?? 0;
        const photoRequestedCount = confirmResult.photoRequestedCount ?? 0;
        const reviewSummaryStatus = confirmResult.reviewSummaryStatus;
        const individualReviewCount = confirmResult.individualReviewCount;

        setUrlStates((prev) =>
          prev.map((s, i) =>
            i === index
              ? {
                  ...s,
                  status: "success",
                  stage: undefined,
                  mode,
                  updatedFields,
                  venueId,
                  existingName,
                  reviewSummaryStatus,
                  individualReviewCount,
                }
              : s,
          ),
        );
        results.push({
          index,
          success: true as const,
          name: extracted.name,
          venueId,
          mode,
          updatedFieldsCount: updatedFields.length,
          photoUploadedCount,
          photoRequestedCount,
          reviewSummaryStatus,
          individualReviewCount,
        });
      } catch {
        setUrlStates((prev) =>
          prev.map((s, i) =>
            i === index ? { ...s, status: "error", error: "予期しないエラー" } : s,
          ),
        );
        results.push({ index, success: false });
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    setUrlLoading(false);
    setProgress(null);

    const successResults = results.filter(
      (r): r is Extract<UrlSubmitResult, { success: true }> => r.success,
    );
    const successCount = successResults.length;
    const failCount = processing.length - successCount;

    if (successCount > 0) {
      // If exactly one URL succeeded, tailor the toast to the mode so
      // merged cases positively surface "added to existing venue".
      if (successCount === 1) {
        const only = successResults[0];
        // Photo count fragment: "· 写真 N/M 枚". Shown so the user sees
        // how many photos actually landed (Phase A).
        const photoFragment =
          only.photoRequestedCount > 0
            ? ` · 写真 ${only.photoUploadedCount}/${only.photoRequestedCount} 枚`
            : "";
        // Zero-photo recovery: when we tried at least one URL but 0 landed,
        // nudge the user toward the cross-site retry without blaming them.
        const zeroPhotoHint =
          only.photoRequestedCount > 0 && only.photoUploadedCount === 0
            ? "写真の取り込みに失敗しました。『別サイトから追加』で再挑戦できます"
            : null;
        // Review summary line (Phase C). Contains review count on completed,
        // or fallback copy on timeout/failed. null when skipped.
        const reviewLine = buildReviewSummaryToastLine(
          only.reviewSummaryStatus,
          only.individualReviewCount,
        );
        const toastLevel =
          only.reviewSummaryStatus === "timeout" ? "info" : "success";
        if (only.mode === "merged") {
          const chipCount = only.updatedFieldsCount;
          const baseMessage =
            chipCount > 0
              ? `✨ ${only.name} に ${chipCount} 件の情報を追加${photoFragment}`
              : `✨ ${only.name} は既に最新の情報です${photoFragment}`;
          const message = reviewLine ? `${baseMessage}・${reviewLine}` : baseMessage;
          showToast(toastLevel, message, {
            duration: 7000,
            action: {
              label: "見る",
              onClick: () => router.push(`/venues/${only.venueId}?updated=1`),
            },
          });
          if (zeroPhotoHint) showToast("info", zeroPhotoHint);
          router.push(`/venues/${only.venueId}?updated=1`);
        } else {
          const baseMessage = `✨ ${only.name} を追加しました${photoFragment}`;
          const message = reviewLine ? `${baseMessage}・${reviewLine}` : baseMessage;
          showToast(toastLevel, message, { duration: 7000 });
          if (zeroPhotoHint) showToast("info", zeroPhotoHint);
          router.push(`/venues/${only.venueId}`);
        }
      } else {
        const mergedCount = successResults.filter(
          (r) => r.mode === "merged",
        ).length;
        const createdCount = successCount - mergedCount;
        const totalPhotosUploaded = successResults.reduce(
          (sum, r) => sum + r.photoUploadedCount,
          0,
        );
        const totalPhotosRequested = successResults.reduce(
          (sum, r) => sum + r.photoRequestedCount,
          0,
        );
        const timeoutCount = successResults.filter(
          (r) => r.reviewSummaryStatus === "timeout",
        ).length;
        const parts: string[] = [];
        if (createdCount > 0) parts.push(`${createdCount}件追加`);
        if (mergedCount > 0) parts.push(`${mergedCount}件統合`);
        if (failCount > 0) parts.push(`${failCount}件失敗`);
        if (totalPhotosRequested > 0) {
          parts.push(`写真 ${totalPhotosUploaded}/${totalPhotosRequested} 枚`);
        }
        if (timeoutCount > 0) {
          parts.push(`${timeoutCount}件はまとめ作成が未完了`);
        }
        showToast(
          failCount > 0 || timeoutCount > 0 ? "info" : "success",
          parts.join(" · "),
        );
        router.refresh();
      }
    } else if (failCount > 0) {
      showToast("error", "URLから読み取れませんでした");
    }
  };

  /**
   * Run the 2-stage URL-import pipeline for a single URL and plug the
   * result into `urlStates` so the skeleton card + success/merge UI fire
   * exactly as they do for paste-based imports.
   *
   * Split out from `handleUrlSubmit` so the F1 name-search flow re-uses
   * the same progressive-fill animation without duplicating the loop.
   */
  const runSingleUrlImport = async (url: string, displayName?: string) => {
    setUrlInput(url);
    // One-item state slot — mirrors what `handleUrlSubmit` populates.
    setUrlStates([{ url, status: "loading", stage: "extract", filledFields: [] }]);
    setUrlLoading(true);
    setProgress({ done: 0, total: 1 });

    try {
      const extractResult = await addVenueFromUrl(url);
      if (extractResult.error || !extractResult.extracted) {
        setUrlStates((prev) =>
          prev.map((s, i) =>
            i === 0
              ? { ...s, status: "error", error: extractResult.error ?? "読み取りに失敗" }
              : s,
          ),
        );
        return;
      }
      const extracted = extractResult.extracted;
      const fieldsToFill: ("name" | "location" | "access" | "photo")[] = ["name"];
      if (extracted.location) fieldsToFill.push("location");
      if (extracted.accessInfo) fieldsToFill.push("access");
      if (extracted.photoUrls.length > 0) fieldsToFill.push("photo");
      setUrlStates((prev) =>
        prev.map((s, i) => (i === 0 ? { ...s, extracted, filledFields: [] } : s)),
      );
      animateFill(0, fieldsToFill);
      await new Promise((r) => setTimeout(r, fieldsToFill.length * 200 + 100));

      const hasReviews = extracted.reviews.length > 0;
      if (hasReviews) {
        setUrlStates((prev) => prev.map((s, i) => (i === 0 ? { ...s, stage: "reviews" } : s)));
        await new Promise((r) => setTimeout(r, 350));
        setUrlStates((prev) => prev.map((s, i) => (i === 0 ? { ...s, stage: "summary" } : s)));
      }

      const confirmResult = await confirmVenueFromUrl(extracted, url);
      if (!confirmResult.success) {
        setUrlStates((prev) =>
          prev.map((s, i) =>
            i === 0 ? { ...s, status: "error", error: "登録に失敗" } : s,
          ),
        );
        return;
      }

      const venueId = confirmResult.venue.id;
      const mode = confirmResult.mode;
      setUrlStates((prev) =>
        prev.map((s, i) =>
          i === 0
            ? {
                ...s,
                status: "success",
                stage: undefined,
                mode,
                updatedFields: confirmResult.updatedFields ?? [],
                venueId,
                existingName: mode === "merged" ? confirmResult.venue.name : undefined,
                reviewSummaryStatus: confirmResult.reviewSummaryStatus,
                individualReviewCount: confirmResult.individualReviewCount,
              }
            : s,
        ),
      );
      const name = displayName ?? extracted.name;
      if (mode === "merged") {
        showToast("success", `✨ ${name} に情報を追加しました`);
        router.push(`/venues/${venueId}?updated=1`);
      } else {
        showToast("success", `✨ ${name} を迎えました`);
        router.push(`/venues/${venueId}`);
      }
    } catch (err) {
      console.error("[runSingleUrlImport] failed", err);
      setUrlStates((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, status: "error", error: "予期しないエラー" } : s,
        ),
      );
    } finally {
      setUrlLoading(false);
      setProgress(null);
    }
  };

  /**
   * F1 name-search handoff.
   *
   * When the user taps a suggestion from the VenueNameSearch combobox we
   * resolve the hit into a concrete URL (via a server action so the
   * Google API key stays off the client bundle) and then re-use the same
   * `addVenueFromUrl → confirmVenueFromUrl` pipeline the paste flow runs.
   */
  const handleNameSearchSelect = async (
    hit: VenueSearchHit,
    sessionToken: string,
  ) => {
    if (urlLoading) return;
    try {
      const { url } = await resolveVenueSearchHitUrl(hit, sessionToken);
      if (!url) {
        showToast(
          "info",
          "公式サイトが見つかりませんでした。URL を貼るか手動で入力してみてください",
        );
        return;
      }
      await runSingleUrlImport(url, hit.name);
    } catch (err) {
      console.error("[handleNameSearchSelect] failed", err);
      showToast("error", "うまく取り込めませんでした。もう一度試してみてください");
    }
  };

  /**
   * Escape hatch: user clicks "別の式場として追加" on a merged card because
   * the dedupe matcher landed on the wrong existing venue. We re-run the
   * confirm step with forceNew = true so a brand-new Venue row is created.
   */
  const handleForceNew = async (index: number) => {
    const target = urlStates[index];
    if (!target?.extracted || target.status !== "success") return;
    setUrlStates((prev) =>
      prev.map((s, i) => (i === index ? { ...s, forcingNew: true } : s)),
    );
    try {
      const result = await confirmVenueFromUrl(target.extracted, target.url, {
        forceNew: true,
      });
      if (!result.success) {
        showToast("error", "別の式場として追加できませんでした");
        setUrlStates((prev) =>
          prev.map((s, i) => (i === index ? { ...s, forcingNew: false } : s)),
        );
        return;
      }
      setUrlStates((prev) =>
        prev.map((s, i) =>
          i === index
            ? {
                ...s,
                forcingNew: false,
                mode: "created",
                updatedFields: [],
                venueId: result.venue.id,
                existingName: undefined,
              }
            : s,
        ),
      );
      showToast("success", `${target.extracted.name} を新しく追加しました`);
      router.push(`/venues/${result.venue.id}`);
    } catch {
      showToast("error", "別の式場として追加できませんでした");
      setUrlStates((prev) =>
        prev.map((s, i) => (i === index ? { ...s, forcingNew: false } : s)),
      );
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
    setProgress(null);
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
      <SheetContent
        side="bottom"
        // Cap the sheet at 520px on desktop so the body feels like a
        // sheet, not a full-width panel. Mobile (<520) stays 100% width.
        // Horizontal padding (px-5 sm:px-7) is applied inside so the URL
        // textarea, CTA, and skeletons aren't glued to the edges.
        className="rounded-t-3xl max-h-[92dvh] overflow-y-auto px-5 sm:px-7 !max-w-[520px] mx-auto"
        style={{
          // E-10: soft dawn radial over the sheet surface. Top-left light
          // glow at 5% — reads as air, not background paint — matches the
          // 晴れ時 register and makes the sheet feel like an editorial
          // welcome rather than a utilitarian form.
          backgroundImage: "var(--gradient-dawn)",
        }}
      >
        {/* Editorial header — eyebrow + 明朝 title */}
        <SheetHeader className="px-0 pt-2 pb-2 mb-1">
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground text-left">
            HARETOKI · Venue
          </p>
          <SheetTitle className="mt-2 font-[family-name:var(--font-display)] text-[20px] font-light tracking-[0.01em] text-foreground text-left leading-[1.35]">
            新しい式場を、迎える
          </SheetTitle>
          <p className="mt-1 text-[13.5px] text-muted-foreground leading-relaxed">
            URL を貼るだけで、必要な情報を読み取ります
          </p>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          {/* ── F1: Name search — the new primary entry point ── */}
          <VenueNameSearch
            disabled={urlLoading}
            onSelect={(hit, token) => {
              void handleNameSearchSelect(hit, token);
            }}
            onEscape={(target) => {
              if (target === "manual") setManualOpen(true);
              // "url" target: input is already visible below — no-op.
            }}
          />

          {/* Hairline divider — gold gradient, same treatment as the
              manual-form divider below the URL block. */}
          <div
            className="relative flex items-center py-0.5"
            aria-hidden
          >
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_35%,transparent)] to-transparent" />
            <span className="px-3 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
              または URL から
            </span>
            <span className="flex-1 h-px bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_35%,transparent)] to-transparent" />
          </div>

          {/* ── URL input — still supported for power users ── */}
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
                placeholder={"式場の URL を貼ってください\n(複数の場合は改行で区切り)"}
                rows={4}
                disabled={urlLoading}
                className="w-full rounded-[14px] border-0 bg-card px-4 py-4 text-[15.5px] placeholder:text-muted-foreground/55 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
                style={{ minHeight: 120 }}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                ゼクシィ・ハナユメ・Wedding Park 等に対応しています
              </p>
              {/* Preview chip — shows the detected URL count so the user
                  can confirm their paste was parsed correctly before
                  submitting. Surfaces only when at least one URL is
                  detected and we're not already running. */}
              {parsedUrls.length > 0 && !urlLoading && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] tracking-[0.04em] tabular-nums ${
                    overLimit
                      ? "bg-destructive/10 text-destructive"
                      : "bg-[var(--gold-subtle)] text-[var(--gold-warm)]"
                  }`}
                  aria-live="polite"
                >
                  {overLimit
                    ? `${parsedUrls.length} 件検出・${BULK_URL_LIMIT}件まで`
                    : `${parsedUrls.length} 件取り込みます`}
                </span>
              )}
            </div>
            {overLimit && (
              <p className="text-[12px] text-destructive leading-relaxed" role="alert">
                1回に取り込めるのは {BULK_URL_LIMIT} 件までです。減らしてから送信してください。
              </p>
            )}
            <Button
              onClick={handleUrlSubmit}
              disabled={urlLoading || parsedUrls.length === 0 || overLimit}
              className="w-full h-12 rounded-[14px] text-[14.5px] font-medium tracking-wide bg-[var(--gold-warm)] hover:bg-[var(--gold-warm)]/90 text-white active:scale-[0.98] transition-transform"
              style={{
                boxShadow:
                  "0 1px 2px rgba(42,35,32,0.06), 0 8px 24px color-mix(in oklab, var(--gold-warm) 22%, transparent)",
              }}
            >
              {urlLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {progress
                    ? `読み込んでいます… ${progress.done}/${progress.total}`
                    : "読み込んでいます…"}
                </>
              ) : parsedUrls.length > 1 ? (
                `まとめて取り込む (${parsedUrls.length})`
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
                  <UrlSkeletonCard
                    key={i}
                    state={state}
                    onManualFallback={() => setManualOpen(true)}
                    onForceNew={() => handleForceNew(i)}
                  />
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
                      別の URL を貼ってみる
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
  onForceNew: () => void;
}

function UrlSkeletonCard({
  state,
  onManualFallback,
  onForceNew,
}: UrlSkeletonCardProps) {
  const { status, extracted, filledFields, error, url, mode, forcingNew, stage } = state;
  const isPending = status === "pending";
  const isLoading = (status === "loading" || isPending) && !extracted;
  const isMerged = status === "success" && mode === "merged";
  const updatedFieldChips = dedupeFieldLabels(state.updatedFields ?? []);
  // Show the stage caption while the server action is still running after
  // the extracted metadata has painted. stage === "extract" is covered by
  // the skeleton itself, so we only surface "reviews" / "summary".
  const showStageCaption =
    status === "loading" && (stage === "reviews" || stage === "summary");

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
        {status === "success" && !isMerged && (
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
        {/* Merged badge — 「既存の式場に統合」の到着感 */}
        {isMerged && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] px-2.5 py-0.5 tracking-[0.06em] backdrop-blur-sm"
            style={{
              border: "1px solid color-mix(in oklab, var(--primary) 35%, transparent)",
            }}
          >
            <Layers className="h-3 w-3" />
            統合しました
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

        {/*
          Stage caption — visible only while the server action is still
          working on reviews / summary (after metadata has painted). This
          is the antidote to the v2 "silent 15s hang" feedback: users see
          *which* step is in flight and that progress is intentional.
        */}
        <AnimatePresence>
          {showStageCaption && stage && (
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 animate-spin text-[var(--gold-warm)]" />
              <span>{STAGE_CAPTIONS[stage]}</span>
            </motion.div>
          )}
          {isPending && (
            <motion.div
              key="queued"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground/70"
              role="status"
              aria-live="polite"
            >
              <span>順番待ち…</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Merged footer — updatedFields chips + escape hatch ("別の式場として追加") */}
      {isMerged && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="border-t border-border/60 px-3 py-3 space-y-2 bg-muted/20"
        >
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            この式場は既に候補にあります。
            {updatedFieldChips.length > 0
              ? "別サイトから以下の情報が追加で見つかりました。"
              : "今回は新しい情報はありませんでした。"}
          </p>
          {updatedFieldChips.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              {updatedFieldChips.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-1 rounded-md bg-primary/5 text-primary text-[11px] px-2 py-1"
                >
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onForceNew}
            disabled={forcingNew}
            className="text-[11.5px] text-muted-foreground underline underline-offset-4 active:text-foreground transition-colors disabled:opacity-40"
          >
            {forcingNew ? "迎えています…" : "別の式場として迎える"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
