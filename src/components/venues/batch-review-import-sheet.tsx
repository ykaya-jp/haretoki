"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { batchImportReviewUrls } from "@/server/actions/reviews";
import type { ReviewSource } from "@/generated/prisma/client";
import type { BatchImportPerUrl } from "@/server/actions/reviews";
import { cn } from "@/lib/utils";

/**
 * R1 — 複数 URL を一気に取り込む sheet。
 *
 * 設計判断 (plan ~/.claude/plans/3-claude-linked-wilkinson.md):
 *   - **textarea 改行区切り**: 上限 10 件、超過は server action の zod が
 *     reject。client 側でも超過件数を 計数表示 (10 / 11) で disable。
 *   - **source default = mwed**: user 主用途 (「式場追加はゼクシィから、
 *     口コミは みんなのウェディング から大量に」)。option で他 4 サイトに
 *     切替可。
 *   - **per-URL 失敗を inline 表示**: 完了 toast (saved=X / skipped=Y /
 *     failed=Z) と一緒に sheet 内に各 URL の status pill を残す。失敗
 *     URL は理由まで読めるようにすることで「次回どう貼り直すか」を
 *     user が判断できる。
 *   - **取り込み中 disable + Sonner progress**: 10 URL × 15s = 約 1-2 分の
 *     待ち時間がある。submit 後 button を Loader2 spinner + 「N 件取り込
 *     み中…」 に置き換え + Sonner で「約 1-2 分かかります」を一度だけ
 *     info toast。途中キャンセルは設計簡素化で非対応。
 *
 * Sheet open prop は内部 state、 trigger 自身はこの component の中。親
 * (review-section.tsx) は既存「別サイトの口コミを追加」 button の横に
 * `<BatchReviewImportSheet venueId={...} />` をマウントするだけで動く。
 */

const SOURCE_OPTIONS: { value: ReviewSource; label: string }[] = [
  // mwed default — 主用途
  { value: "minna_no_wedding", label: "みんなのウェディング" },
  { value: "zexy", label: "ゼクシィ" },
  { value: "wedding_park", label: "ウェディングパーク" },
  { value: "hanayume", label: "ハナユメ" },
  { value: "mynavi", label: "マイナビ" },
];

const URL_CAP = 10;

interface BatchReviewImportSheetProps {
  venueId: string;
}

export function BatchReviewImportSheet({ venueId }: BatchReviewImportSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [source, setSource] = useState<ReviewSource>("minna_no_wedding");
  const [perUrl, setPerUrl] = useState<BatchImportPerUrl[] | null>(null);
  const [isPending, startTransition] = useTransition();

  // Parse the textarea on every keystroke — cheap (≤ 10 lines), and
  // keeps the counter pill in sync with what the server will see.
  // Trim each line, drop empties, dedupe within the input itself
  // (so a sloppy paste with the same URL twice doesn't waste a slot).
  const urls = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const uniqueUrls = Array.from(new Set(urls));
  const overCap = uniqueUrls.length > URL_CAP;

  const handleSubmit = () => {
    if (uniqueUrls.length === 0 || overCap || isPending) return;
    setPerUrl(null);
    toast.info(
      `${uniqueUrls.length} 件を取り込んでいます (約 1-2 分)`,
      { duration: 6000 },
    );
    startTransition(async () => {
      const result = await batchImportReviewUrls(venueId, uniqueUrls, source);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const { summary, perUrl: rows } = result;
      setPerUrl(rows);
      // Compose toast based on outcome mix.
      if (summary.saved > 0 && summary.failed === 0) {
        toast.success(
          summary.skipped > 0
            ? `${summary.saved} 件取り込み (skip ${summary.skipped})`
            : `${summary.saved} 件の口コミを取り込みました`,
        );
      } else if (summary.saved > 0 && summary.failed > 0) {
        toast.warning(
          `${summary.saved} 件取り込み・${summary.failed} 件失敗 (skip ${summary.skipped})`,
        );
      } else if (summary.saved === 0 && summary.skipped > 0 && summary.failed === 0) {
        toast.info(
          `${summary.skipped} 件すべて取り込み済の URL でした`,
        );
      } else {
        toast.error(
          `取り込みできませんでした (失敗 ${summary.failed} / skip ${summary.skipped})`,
        );
      }
      // Refresh so the venue page picks up the new Review rows + ratio bar.
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* base-ui Dialog.Trigger は asChild を取らないので render prop で
          shadcn Button を渡す pattern (review-estimate-edit-sheet と同型)。 */}
      <SheetTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            aria-label="複数の口コミ URL をまとめて取り込みます (最大 10 件)"
            title="複数の口コミ URL をまとめて取り込みます (最大 10 件)"
          />
        }
      >
        <Plus className="h-4 w-4" />
        複数 URL を貼る
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>複数 URL をまとめて取り込む</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="batch-source">口コミサイト</Label>
            <select
              id="batch-source"
              value={source}
              onChange={(e) => setSource(e.target.value as ReviewSource)}
              disabled={isPending}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="batch-urls">
                URL を改行区切りで貼り付け
              </Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overCap
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {uniqueUrls.length} / {URL_CAP}
              </span>
            </div>
            <textarea
              id="batch-urls"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isPending}
              rows={8}
              className="w-full rounded-lg border border-border bg-card p-2 font-mono text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder={`https://www.mwed.jp/hall/12345/\nhttps://www.mwed.jp/hall/67890/\n...`}
            />
            {overCap && (
              <p className="text-xs text-destructive">
                1 度に取り込めるのは {URL_CAP} 件までです。分割してお試しください。
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              対応: ゼクシィ・Wedding Park・ハナユメ・マイナビ・みんなのウェディング。
              既に取り込み済の URL は自動でスキップされます。
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={uniqueUrls.length === 0 || overCap || isPending}
            className="w-full"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uniqueUrls.length} 件 取り込み中…
              </>
            ) : (
              `${uniqueUrls.length} 件をまとめて取り込む`
            )}
          </Button>

          {perUrl && perUrl.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-medium text-muted-foreground">
                取り込み結果
              </p>
              <ul className="space-y-1">
                {perUrl.map((row, i) => (
                  <li
                    key={`${row.url}-${i}`}
                    className="flex items-start gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5"
                  >
                    {row.status === "saved" && (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                    )}
                    {row.status === "skipped" && (
                      <MinusCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    {row.status === "failed" && (
                      <AlertCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] text-foreground">
                        {row.url}
                      </p>
                      {row.message && (
                        <p
                          className={cn(
                            "mt-0.5 text-[11px] leading-tight",
                            row.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {row.message}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
