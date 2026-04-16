"use client";

import { useState } from "react";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
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
import {
  planInputSchema,
  type PlanInput,
} from "@/server/actions/plan-schema";
import { upsertVenuePlan, deleteVenuePlan } from "@/server/actions/plans";

export interface PlanEditorInitialPlan {
  id: string;
  name: string;
  basePrice: number | null;
  guestCountMin: number | null;
  guestCountMax: number | null;
  includedItems: string[];
  excludedItems: string[];
  bringInItems: Array<{ item: string; fee?: number }>;
  dressBrideCount: number | null;
  dressGroomCount: number | null;
  dressBudgetCapYen: number | null;
  dressAllowanceNote: string | null;
  campaigns: Array<{ name: string; discount?: string }>;
  notes: string | null;
}

interface PlanEditorSheetProps {
  venueId: string;
  initialPlan?: PlanEditorInitialPlan;
  /** Render-prop trigger. Defaults to a small "プランを編集" / "+ 新しいプランを追加" button. */
  trigger?: React.ReactNode;
}


export function PlanEditorSheet({
  venueId,
  initialPlan,
  trigger,
}: PlanEditorSheetProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  // useFieldArray on primitive arrays needs a wrapped shape; we manage
  // includedItems/excludedItems as Array<{ value: string }> in the form,
  // then unwrap on submit.
  type StringRow = { value: string };
  type FormShape = {
    id?: string;
    name: string;
    basePrice?: number;
    guestCountMin?: number;
    guestCountMax?: number;
    includedItemsRows: StringRow[];
    excludedItemsRows: StringRow[];
    bringInItems: Array<{ item: string; fee?: number }>;
    dressBrideCount?: number;
    dressGroomCount?: number;
    dressBudgetCapYen?: number;
    dressAllowanceNote?: string;
    campaigns: Array<{ name: string; discount?: string }>;
    notes?: string;
  };

  const defaults: FormShape = initialPlan
    ? {
        id: initialPlan.id,
        name: initialPlan.name,
        basePrice: initialPlan.basePrice ?? undefined,
        guestCountMin: initialPlan.guestCountMin ?? undefined,
        guestCountMax: initialPlan.guestCountMax ?? undefined,
        includedItemsRows: initialPlan.includedItems.map((v) => ({ value: v })),
        excludedItemsRows: initialPlan.excludedItems.map((v) => ({ value: v })),
        bringInItems: initialPlan.bringInItems,
        dressBrideCount: initialPlan.dressBrideCount ?? undefined,
        dressGroomCount: initialPlan.dressGroomCount ?? undefined,
        // Store as 万円 in the input for friendlier UX; convert back to yen on submit.
        dressBudgetCapYen:
          initialPlan.dressBudgetCapYen != null
            ? Math.round(initialPlan.dressBudgetCapYen / 10000)
            : undefined,
        dressAllowanceNote: initialPlan.dressAllowanceNote ?? "",
        campaigns: initialPlan.campaigns,
        notes: initialPlan.notes ?? "",
      }
    : {
        name: "",
        includedItemsRows: [],
        excludedItemsRows: [],
        bringInItems: [],
        campaigns: [],
        dressAllowanceNote: "",
        notes: "",
      };

  // Form-level zod validation runs on the unwrapped PlanInput shape after
  // submit, so we don't pass a resolver to RHF — we validate manually below
  // to keep the wrapped/unwrapped seam in one place.
  const form = useForm<FormShape>({
    defaultValues: defaults,
    // Disable RHF's resolver to keep wrap/unwrap shape conversion explicit.
    resolver: undefined as unknown as Resolver<FormShape>,
  });

  const includedFields = useFieldArray({
    control: form.control,
    name: "includedItemsRows",
  });
  const excludedFields = useFieldArray({
    control: form.control,
    name: "excludedItemsRows",
  });
  const bringInFields = useFieldArray({
    control: form.control,
    name: "bringInItems",
  });
  const campaignFields = useFieldArray({
    control: form.control,
    name: "campaigns",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload: PlanInput = {
        ...(values.id ? { id: values.id } : {}),
        name: values.name,
        basePrice: values.basePrice,
        guestCountMin: values.guestCountMin,
        guestCountMax: values.guestCountMax,
        includedItems: values.includedItemsRows
          .map((r) => r.value.trim())
          .filter((v) => v.length > 0),
        excludedItems: values.excludedItemsRows
          .map((r) => r.value.trim())
          .filter((v) => v.length > 0),
        bringInItems: values.bringInItems
          .filter((bi) => bi.item.trim().length > 0)
          .map((bi) => ({
            item: bi.item.trim(),
            fee: bi.fee,
          })),
        dressBrideCount: values.dressBrideCount,
        dressGroomCount: values.dressGroomCount,
        // 万円 → yen
        dressBudgetCapYen:
          values.dressBudgetCapYen != null
            ? Math.round(values.dressBudgetCapYen * 10000)
            : undefined,
        dressAllowanceNote: values.dressAllowanceNote?.trim() || undefined,
        campaigns: values.campaigns
          .filter((c) => c.name.trim().length > 0)
          .map((c) => ({
            name: c.name.trim(),
            discount: c.discount?.trim() || undefined,
          })),
        notes: values.notes?.trim() || undefined,
      };

      // Validate on the client first for fast feedback.
      const local = planInputSchema.safeParse(payload);
      if (!local.success) {
        const first = Object.values(local.error.flatten().fieldErrors)[0]?.[0];
        toast.error(first ?? "入力内容を確認してください");
        return;
      }

      const result = await upsertVenuePlan(venueId, local.data);
      if (!result.success) {
        const first = Object.values(result.error)[0]?.[0];
        toast.error(first ?? "うまく残せませんでした");
        return;
      }

      toast.success(initialPlan ? "プランを書き直しました" : "プランを追加しました");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("うまく残せませんでした");
    } finally {
      setSubmitting(false);
    }
  });

  const onDelete = async () => {
    if (!initialPlan) return;
    if (!confirm("このプラン、手放しますか？")) return;
    setDeleting(true);
    try {
      const result = await deleteVenuePlan(initialPlan.id);
      if (result.success) {
        toast.success("プランを手放しました");
        setOpen(false);
        router.refresh();
      } else {
        toast.error("手放せませんでした");
      }
    } finally {
      setDeleting(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-1">
      {initialPlan ? "プランを編集" : "新しいプランを追加"}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger ? undefined : defaultTrigger}>
        {trigger}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="font-[family-name:var(--font-display)] font-normal">
            {initialPlan ? "プランを編集" : "新しいプラン"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-4 space-y-6 pb-4">
          {/* Basic */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">プラン名 *</Label>
              <Input
                id="plan-name"
                {...form.register("name")}
                placeholder="プレミアムウェディングプラン"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-base-price">基本価格（円）</Label>
              <Input
                id="plan-base-price"
                type="number"
                inputMode="numeric"
                {...form.register("basePrice", { valueAsNumber: true })}
                placeholder="3000000"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-guest-min">最小人数</Label>
                <Input
                  id="plan-guest-min"
                  type="number"
                  inputMode="numeric"
                  {...form.register("guestCountMin", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-guest-max">最大人数</Label>
                <Input
                  id="plan-guest-max"
                  type="number"
                  inputMode="numeric"
                  {...form.register("guestCountMax", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Included */}
          <FieldArraySection
            title="プランに含まれるもの"
            onAdd={() => includedFields.append({ value: "" })}
          >
            {includedFields.fields.map((field, i) => (
              <RowWithRemove
                key={field.id}
                onRemove={() => includedFields.remove(i)}
              >
                <Input
                  {...form.register(`includedItemsRows.${i}.value` as const)}
                  placeholder="衣裳1着"
                />
              </RowWithRemove>
            ))}
          </FieldArraySection>

          {/* Excluded */}
          <FieldArraySection
            title="別途必要なもの"
            onAdd={() => excludedFields.append({ value: "" })}
          >
            {excludedFields.fields.map((field, i) => (
              <RowWithRemove
                key={field.id}
                onRemove={() => excludedFields.remove(i)}
              >
                <Input
                  {...form.register(`excludedItemsRows.${i}.value` as const)}
                  placeholder="装花アップグレード"
                />
              </RowWithRemove>
            ))}
          </FieldArraySection>

          {/* Bring-in */}
          <FieldArraySection
            title="お持ち込みできるもの（持込料）"
            onAdd={() => bringInFields.append({ item: "", fee: undefined })}
          >
            {bringInFields.fields.map((field, i) => (
              <RowWithRemove
                key={field.id}
                onRemove={() => bringInFields.remove(i)}
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <Input
                    {...form.register(`bringInItems.${i}.item` as const)}
                    placeholder="ドレス"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    {...form.register(`bringInItems.${i}.fee` as const, {
                      valueAsNumber: true,
                    })}
                    placeholder="持込料（円）"
                  />
                </div>
              </RowWithRemove>
            ))}
          </FieldArraySection>

          {/* Dress structured */}
          <div className="space-y-3 rounded-xl bg-muted/30 p-3">
            <p className="text-sm font-normal">ドレス</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dress-bride">新婦の着数</Label>
                <Input
                  id="dress-bride"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5}
                  {...form.register("dressBrideCount", { valueAsNumber: true })}
                  placeholder="2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dress-groom">新郎の着数</Label>
                <Input
                  id="dress-groom"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={3}
                  {...form.register("dressGroomCount", { valueAsNumber: true })}
                  placeholder="1"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dress-budget">上限金額（万円）</Label>
              <Input
                id="dress-budget"
                type="number"
                inputMode="numeric"
                {...form.register("dressBudgetCapYen", { valueAsNumber: true })}
                placeholder="80"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dress-note">補足メモ</Label>
              <textarea
                id="dress-note"
                {...form.register("dressAllowanceNote")}
                rows={2}
                className="w-full rounded-lg border border-border bg-card p-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="提携ブランド以外は持込料あり、など"
              />
            </div>
          </div>

          {/* Campaigns */}
          <FieldArraySection
            title="うれしい特典"
            onAdd={() =>
              campaignFields.append({ name: "", discount: undefined })
            }
          >
            {campaignFields.fields.map((field, i) => (
              <RowWithRemove
                key={field.id}
                onRemove={() => campaignFields.remove(i)}
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <Input
                    {...form.register(`campaigns.${i}.name` as const)}
                    placeholder="特典名"
                  />
                  <Input
                    {...form.register(`campaigns.${i}.discount` as const)}
                    placeholder="割引内容（任意）"
                  />
                </div>
              </RowWithRemove>
            ))}
          </FieldArraySection>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="plan-notes">補足メモ</Label>
            <textarea
              id="plan-notes"
              {...form.register("notes")}
              rows={3}
              className="w-full rounded-lg border border-border bg-card p-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : initialPlan ? (
                "更新する"
              ) : (
                "追加する"
              )}
            </Button>
            {initialPlan && (
              <Button
                type="button"
                variant="outline"
                onClick={onDelete}
                disabled={deleting}
                className="w-full text-destructive"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "このプランを削除"
                )}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* --- Sub-components ------------------------------------------------------ */

function FieldArraySection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-normal">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="gap-1"
          aria-label={`${title}を追加`}
        >
          <Plus className="h-3.5 w-3.5" />
          追加
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RowWithRemove({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">{children}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label="削除"
        className="shrink-0 text-muted-foreground"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
