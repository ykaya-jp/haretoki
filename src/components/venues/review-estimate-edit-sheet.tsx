"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateReviewEstimateIncrease } from "@/server/actions/reviews";

/**
 * Form-level schema — man-en (万円) user input for readability. We convert
 * to yen (× 10_000) before calling the server action, which validates against
 * the underlying `estimateIncreaseSchema`.
 */
const formSchema = z
  .object({
    initialMan: z
      .number({ message: "初期見積もりを入力してください" })
      .nonnegative("0以上で入力してください"),
    finalMan: z
      .number({ message: "最終金額を入力してください" })
      .nonnegative("0以上で入力してください"),
    note: z.string().max(500, "500文字以内で入力してください").optional(),
  })
  .refine((v) => v.finalMan >= v.initialMan, {
    path: ["finalMan"],
    message: "最終金額は初期見積もり以上で入力してください",
  });

type FormValues = z.infer<typeof formSchema>;

interface ReviewEstimateEditSheetProps {
  reviewId: string;
  /** Pre-fill from existing estimateIncrease payload (yen). */
  initial?: {
    initialYen?: number;
    finalYen?: number;
    note?: string;
  };
}

export function ReviewEstimateEditSheet({
  reviewId,
  initial,
}: ReviewEstimateEditSheetProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      initialMan:
        initial?.initialYen != null
          ? Math.round(initial.initialYen / 10000)
          : (undefined as unknown as number),
      finalMan:
        initial?.finalYen != null
          ? Math.round(initial.finalYen / 10000)
          : (undefined as unknown as number),
      note: initial?.note ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const initialYen = Math.round(values.initialMan * 10000);
      const finalYen = Math.round(values.finalMan * 10000);
      const deltaYen = finalYen - initialYen;
      const deltaPct =
        initialYen > 0 ? Math.round((deltaYen / initialYen) * 10000) / 100 : 0;

      const result = await updateReviewEstimateIncrease(reviewId, {
        initial: initialYen,
        final: finalYen,
        deltaYen,
        deltaPct,
        note: values.note?.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "うまく残せませんでした");
        return;
      }

      toast.success("書き直しました");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("うまく残せませんでした");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="この口コミの見積もり情報を編集"
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-[var(--gold-warm)]/30 bg-[color-mix(in_oklab,var(--gold-warm)_8%,transparent)] px-2.5 text-[11px] text-[var(--gold-warm)] transition-colors active:scale-[0.98]"
          />
        }
      >
        <Pencil className="h-3 w-3" aria-hidden />
        編集
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-[family-name:var(--font-display)] font-normal">
            見積もり情報を編集
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-5 px-4 pb-6">
          <p className="text-xs leading-relaxed text-muted-foreground">
            口コミから読み取った初期見積もりと最終金額を記録すると、
            式場全体の見積もり上昇率が更新されます。
          </p>

          <div className="space-y-2">
            <Label htmlFor="review-initial-man">
              初期見積もり（万円）
            </Label>
            <Input
              id="review-initial-man"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              {...form.register("initialMan", { valueAsNumber: true })}
              placeholder="300"
            />
            {form.formState.errors.initialMan && (
              <p className="text-xs text-destructive">
                {form.formState.errors.initialMan.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-final-man">最終金額（万円）</Label>
            <Input
              id="review-final-man"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              {...form.register("finalMan", { valueAsNumber: true })}
              placeholder="380"
            />
            {form.formState.errors.finalMan && (
              <p className="text-xs text-destructive">
                {form.formState.errors.finalMan.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-note">備考（任意）</Label>
            <textarea
              id="review-note"
              {...form.register("note")}
              rows={3}
              className="w-full rounded-lg border border-border bg-card p-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="衣裳・装花のグレードアップで上昇、など"
            />
            {form.formState.errors.note && (
              <p className="text-xs text-destructive">
                {form.formState.errors.note.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "残す"
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
