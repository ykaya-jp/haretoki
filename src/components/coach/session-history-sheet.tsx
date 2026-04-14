"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { renameCoachSession, deleteCoachSession } from "@/server/actions/coach";
import type { SessionListItem } from "@/server/actions/coach";

interface SessionHistorySheetProps {
  sessions: SessionListItem[];
  currentSessionId?: string;
}

/** Groups sessions by relative date bucket (ChatGPT-style). */
function groupSessions(sessions: SessionListItem[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86_400_000);

  const groups: { label: string; items: SessionListItem[] }[] = [
    { label: "今日", items: [] },
    { label: "昨日", items: [] },
    { label: "今週", items: [] },
    { label: "それ以前", items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updatedAt);
    if (d >= startOfToday) {
      groups[0].items.push(s);
    } else if (d >= startOfYesterday) {
      groups[1].items.push(s);
    } else if (d >= startOfWeek) {
      groups[2].items.push(s);
    } else {
      groups[3].items.push(s);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

/** Relative time label using Intl.RelativeTimeFormat. */
function relativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  const fmt = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });
  if (Math.abs(diffMin) < 60) return fmt.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return fmt.format(diffHr, "hour");
  return fmt.format(diffDay, "day");
}

interface RowMenuProps {
  session: SessionListItem;
  onClose: () => void;
}

function RowMenu({ session, onClose }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(session.title ?? "");
  const [, startTransition] = useTransition();

  const handleRename = () => {
    setRenaming(true);
    setOpen(false);
  };

  const submitRename = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await renameCoachSession(session.id, title.trim());
      setRenaming(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteCoachSession(session.id);
      setOpen(false);
      onClose();
    });
  };

  if (renaming) {
    return (
      <form
        className="flex items-center gap-2 py-1"
        onSubmit={(e) => {
          e.preventDefault();
          submitRename();
        }}
      >
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={100}
        />
        <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">
          保存
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => setRenaming(false)}
        >
          取消
        </Button>
      </form>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="操作メニュー"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-9 z-50 min-w-[120px] rounded-lg border border-border bg-popover py-1 shadow-md">
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted active:bg-muted/70"
              onClick={handleRename}
            >
              <Pencil className="h-3.5 w-3.5" />
              名前を変更
            </button>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted active:bg-muted/70"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SessionHistorySheet({
  sessions,
  currentSessionId,
}: SessionHistorySheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const groups = groupSessions(sessions);

  const handleSelect = (id: string) => {
    router.push(`/coach?session=${id}`);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="会話履歴を開く"
            className="h-11 w-11"
          />
        }
      >
        <History className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>会話履歴</SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto py-2" style={{ height: "calc(100% - 56px)" }}>
          {groups.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              まだ会話がありません
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <p className="px-4 py-2 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((session) => (
                  <div
                    key={session.id}
                    className={`flex items-center gap-1 px-3 py-2 hover:bg-muted active:bg-muted/70 ${
                      session.id === currentSessionId ? "bg-muted/60" : ""
                    }`}
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => handleSelect(session.id)}
                    >
                      <p className="truncate text-sm font-light">
                        {session.title ?? "無題の会話"}
                      </p>
                      {session.preview && (
                        <p className="truncate text-xs text-muted-foreground">
                          {session.preview}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {relativeTime(new Date(session.updatedAt))}
                      </p>
                    </button>
                    <RowMenu session={session} onClose={() => setOpen(false)} />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
