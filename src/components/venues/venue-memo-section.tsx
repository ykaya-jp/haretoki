"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotebookPen, Pencil, Trash2, Loader2, Check, X } from "lucide-react";
import {
  addVenueMemo,
  updateVenueMemo,
  deleteVenueMemo,
  type VenueMemoView,
} from "@/server/actions/venue-memos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Venue-scoped memo section. Sits directly above the 見学の記録 section
 * so couples can jot pre-visit thoughts ("駅近そうだけど人通りはどうか？")
 * and post-comparison summaries ("結局 A の方が予算的に現実的だった")
 * without having to schedule a visit row first.
 *
 * Multi-author: any project member writes their own memos; everyone reads
 * everyone else's. Edit/delete is restricted to the author. Soft-delete
 * + revalidatePath only — no realtime push for now (sibling VisitNote
 * has it; we can add later if usage warrants).
 */

const MAX_LEN = 2000;

interface VenueMemoSectionProps {
  venueId: string;
  memos: VenueMemoView[];
  currentUserId: string;
  partnerUserId?: string;
}

export function VenueMemoSection({
  venueId,
  memos,
  currentUserId,
  partnerUserId,
}: VenueMemoSectionProps) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const handleAdd = () => {
    const content = draft.trim();
    if (!content) return;
    if (content.length > MAX_LEN) {
      toast.error(`メモは${MAX_LEN}文字以内で入力してください`);
      return;
    }
    startTransition(async () => {
      const result = await addVenueMemo(venueId, content);
      if (!result.success) {
        toast.error(result.error ?? "保存できませんでした");
        return;
      }
      toast.success("メモを残しました");
      setDraft("");
      router.refresh();
    });
  };

  const handleStartEdit = (memo: VenueMemoView) => {
    setEditingId(memo.id);
    setEditText(memo.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleSaveEdit = (memoId: string) => {
    const content = editText.trim();
    if (!content) {
      toast.error("メモを入力してください");
      return;
    }
    startTransition(async () => {
      const result = await updateVenueMemo(memoId, content);
      if (!result.success) {
        toast.error(result.error ?? "更新できませんでした");
        return;
      }
      toast.success("メモを更新しました");
      setEditingId(null);
      setEditText("");
      router.refresh();
    });
  };

  const handleDelete = (memoId: string) => {
    if (!confirm("このメモを削除しますか？")) return;
    startTransition(async () => {
      const result = await deleteVenueMemo(memoId);
      if (!result.success) {
        toast.error(result.error ?? "削除できませんでした");
        return;
      }
      toast.success("メモを削除しました");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen
            className="h-4 w-4 text-[var(--gold-warm)]"
            strokeWidth={1.6}
            aria-hidden="true"
          />
          <h2 className="text-eyebrow text-[var(--gold-warm)]">メモ</h2>
        </div>
        {memos.length > 0 && (
          <span className="tabular-nums text-fluid-xs text-muted-foreground">
            {memos.length} 件
          </span>
        )}
      </div>

      <p className="text-fluid-xs leading-relaxed text-muted-foreground">
        気になったこと、見学前後の感想を、ここに残しておけます。
      </p>

      {/* Quick capture */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例: 駅から徒歩 5 分、雨の日の動線が気になる"
          rows={3}
          maxLength={MAX_LEN}
          disabled={isPending}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-fluid-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[var(--gold-warm)]/40 disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span
            className={cn(
              "tabular-nums text-fluid-xs",
              draft.length > MAX_LEN * 0.9
                ? "text-amber-600"
                : "text-muted-foreground/60",
            )}
          >
            {draft.length} / {MAX_LEN}
          </span>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isPending || draft.trim().length === 0}
            size="sm"
            className="h-9"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              "保存"
            )}
          </Button>
        </div>
      </div>

      {/* Memo list */}
      {memos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background px-4 py-6 text-center">
          <p className="text-fluid-xs text-muted-foreground">
            まだメモはありません。気付いたことから書いてみましょう。
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {memos.map((memo) => {
            const isMine = memo.userId === currentUserId;
            const isPartner = partnerUserId && memo.userId === partnerUserId;
            const authorLabel = isMine ? "自分" : isPartner ? "パートナー" : "メンバー";
            const isEditing = editingId === memo.id;
            return (
              <li
                key={memo.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-[family-name:var(--font-display)] text-fluid-xs font-light text-foreground">
                    {authorLabel}
                  </span>
                  <RelativeTime date={memo.createdAt} />
                </div>
                {isEditing ? (
                  <div className="mt-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      maxLength={MAX_LEN}
                      disabled={isPending}
                      className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-fluid-sm leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--gold-warm)]/40 disabled:opacity-60"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isPending}
                        size="sm"
                        variant="ghost"
                        className="h-8"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        <span className="ml-1">取消</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleSaveEdit(memo.id)}
                        disabled={isPending || editText.trim().length === 0}
                        size="sm"
                        className="h-8"
                      >
                        {isPending ? (
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            <span className="ml-1">更新</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 whitespace-pre-wrap text-fluid-sm leading-relaxed text-foreground">
                      {memo.content}
                    </p>
                    {isMine && (
                      <div className="mt-3 flex justify-end gap-1">
                        <Button
                          type="button"
                          onClick={() => handleStartEdit(memo)}
                          disabled={isPending}
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground"
                          aria-label="編集"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleDelete(memo.id)}
                          disabled={isPending}
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-muted-foreground"
                          aria-label="削除"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RelativeTime({ date }: { date: Date }) {
  // Render-time diff so the label stays correct on remount. Locale-stable
  // ja-JP relative format ("2 日前" / "3 時間前" / "たった今").
  const [label, setLabel] = useState(() => formatRelative(date));
  useEffect(() => {
    const id = setInterval(() => setLabel(formatRelative(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);
  return (
    <time
      dateTime={date.toISOString()}
      className="tabular-nums text-fluid-xs text-muted-foreground"
    >
      {label}
    </time>
  );
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "たった今";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} 分前`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} 時間前`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} 日前`;
  const month = Math.round(day / 30);
  if (month < 12) return `${month} か月前`;
  return new Date(date).toLocaleDateString("ja-JP");
}
