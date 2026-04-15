"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSavedSearch,
  type SavedSearchFilters,
} from "@/server/actions/saved-searches";

interface SaveSearchButtonProps {
  /** Current active filters to be saved */
  filters: SavedSearchFilters;
  /** Whether the user has already reached the 5-item limit */
  atLimit?: boolean;
}

export function SaveSearchButton({ filters, atLimit = false }: SaveSearchButtonProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  const hasFilters =
    (filters.area && filters.area.length > 0) ||
    filters.budgetMax !== undefined ||
    filters.capacityMin !== undefined ||
    (filters.vibeTags && filters.vibeTags.length > 0) ||
    (filters.keyword && filters.keyword.trim().length > 0);

  if (!hasFilters) return null;

  function handleSave() {
    if (!label.trim()) {
      toast.error("条件名を入力してください");
      return;
    }
    startTransition(async () => {
      const result = await createSavedSearch(label.trim(), filters);
      if (result.ok) {
        toast.success("保存しました");
        setOpen(false);
        setLabel("");
      } else if (result.reason === "limit") {
        toast.error(`保存できる検索条件は最大 5 件です`);
        setOpen(false);
      } else {
        toast.error("保存に失敗しました。もう一度お試しください。");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        disabled={atLimit}
        render={
          <button
            type="button"
            title={atLimit ? "保存できる検索条件は最大 5 件です" : "この条件を保存"}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[var(--gold-warm)]/60 bg-[var(--gold-subtle)] px-3 text-xs text-[var(--gold-warm)] transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          />
        }
      >
        <Bookmark className="h-3.5 w-3.5" />
        <span>この条件を保存</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-[family-name:var(--font-display)] font-extralight text-xl tracking-wide">
            検索条件を保存
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search-label" className="text-sm text-muted-foreground">
              条件の名前
            </Label>
            <Input
              id="search-label"
              placeholder="例: 東京都内・300万以下"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className="min-h-11"
              autoFocus
            />
          </div>

          {/* Filter preview */}
          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            {filters.area && filters.area.length > 0 && (
              <p>エリア: {filters.area.join("・")}</p>
            )}
            {filters.budgetMax !== undefined && (
              <p>予算上限: {filters.budgetMax.toLocaleString()}円</p>
            )}
            {filters.capacityMin !== undefined && (
              <p>収容人数: {filters.capacityMin}人以上</p>
            )}
            {filters.vibeTags && filters.vibeTags.length > 0 && (
              <p>スタイル: {filters.vibeTags.join("・")}</p>
            )}
            {filters.keyword && (
              <p>キーワード: {filters.keyword}</p>
            )}
          </div>
        </div>

        <SheetFooter className="flex-row gap-3 pb-safe">
          <SheetClose
            disabled={isPending}
            render={
              <Button variant="outline" className="flex-1 min-h-11" />
            }
          >
            キャンセル
          </SheetClose>
          <Button
            className="flex-1 min-h-11"
            onClick={handleSave}
            disabled={isPending || !label.trim()}
          >
            {isPending ? "保存中..." : "保存する"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
