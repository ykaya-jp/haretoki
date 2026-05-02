"use client";

import { useState, useTransition } from "react";
import { Copy, Eye, Plus, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createFamilyInvitation,
  revokeFamilyInvitation,
  type FamilyInvitationLink,
} from "@/server/actions/family-invitations";

/**
 * Track C-1 family-share owner UI.
 *
 * Owns the issue + revoke flow plus the native share-sheet integration.
 * The server-rendered parent passes `initialLinks` so the first paint
 * is fresh; subsequent state changes (issue / revoke) update locally
 * and re-fetch via the action's `revalidatePath` on the next nav.
 *
 * Native share fallback: `navigator.share` is iOS / Android / Chrome
 * desktop only. When unavailable we fall back to clipboard-copy with
 * a toast — the URL is the same in both paths so the receiving party
 * never sees a difference.
 */
interface Props {
  initialLinks: FamilyInvitationLink[];
}

export function FamilyShareManager({ initialLinks }: Props) {
  const [links, setLinks] = useState<FamilyInvitationLink[]>(initialLinks);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isCreating, startCreate] = useTransition();

  const activeLink = links.find(
    (l) => !l.revokedAt && new Date(l.expiresAt).getTime() > Date.now(),
  );

  function handleCreate() {
    startCreate(async () => {
      try {
        const result = await createFamilyInvitation();
        if (!result.ok || !result.link) {
          throw new Error(result.error ?? "リンクの発行に失敗しました");
        }
        // Re-shape: prepend the new link, mark any prior live link as
        // freshly revoked so the UI matches the server's transactional
        // revoke-on-issue.
        const now = new Date().toISOString();
        setLinks((prev) => [
          result.link!,
          ...prev.map((l) =>
            !l.revokedAt && new Date(l.expiresAt).getTime() > Date.now()
              ? { ...l, revokedAt: now }
              : l,
          ),
        ]);
        toast.success("リンクをお作りしました");
        // Auto-share immediately after creation — the user pressed
        // "発行" with intent to share, not to file in the cabinet.
        await maybeShare(result.link.url);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "リンクの発行に失敗しました";
        toast.error(message);
      }
    });
  }

  function handleRevoke(id: string) {
    setPendingId(id);
    startCreate(async () => {
      try {
        const result = await revokeFamilyInvitation({ id });
        if (!result.ok) throw new Error(result.error ?? "取り消しに失敗しました");
        const now = new Date().toISOString();
        setLinks((prev) =>
          prev.map((l) => (l.id === id ? { ...l, revokedAt: now } : l)),
        );
        toast.success("リンクを取り消しました");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "取り消しに失敗しました";
        toast.error(message);
      } finally {
        setPendingId(null);
      }
    });
  }

  async function maybeShare(url: string) {
    if (typeof navigator === "undefined") return;
    const shareData = {
      title: "晴れ時 — 式場が決まりました",
      text: "ふたりが選んだ式場をおすそわけします。",
      url,
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // AbortError = user dismissed the sheet — silent. Anything else
        // falls through to clipboard copy.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    await copyToClipboard(url);
  }

  async function copyToClipboard(url: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("リンクをコピーできませんでした");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("リンクをコピーしました");
    } catch {
      toast.error("リンクをコピーできませんでした");
    }
  }

  return (
    <section className="space-y-4">
      {activeLink ? (
        <div className="space-y-3 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="space-y-1">
            <p className="text-[10.5px] uppercase tracking-[0.3em] text-muted-foreground">
              Active link
            </p>
            <p className="break-all font-mono text-[11.5px] leading-snug text-muted-foreground">
              {activeLink.url}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3 w-3" aria-hidden="true" />
              <dt className="sr-only">閲覧回数</dt>
              <dd>
                <span className="tabular-nums">{activeLink.viewCount}</span> 回
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">期限</dt>
              <dd>
                <span className="text-foreground/80">期限</span>{" "}
                <span className="tabular-nums">
                  {formatExpiry(activeLink.expiresAt)}
                </span>
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => maybeShare(activeLink.url)}
              className="min-h-11 flex-1 gap-1.5"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              ご家族に送る
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(activeLink.url)}
              className="min-h-11 gap-1.5"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              コピー
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleRevoke(activeLink.id)}
              disabled={pendingId === activeLink.id || isCreating}
              className="min-h-11 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              取り消す
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-5 text-center">
          <p className="text-sm text-foreground">
            まだリンクをお作りしていません
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            「リンクを作る」で 30 日有効の家族向け閲覧ページが生まれます。
          </p>
          <Button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            className="mt-4 inline-flex min-h-11 gap-1.5"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {isCreating ? "発行中…" : "リンクを作る"}
          </Button>
        </div>
      )}

      {activeLink ? (
        <button
          type="button"
          onClick={handleCreate}
          disabled={isCreating}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 self-start rounded-full border border-border/60 bg-background px-4 text-xs text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98]",
            isCreating && "opacity-50",
          )}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          {isCreating ? "発行中…" : "別のリンクを作り直す"}
        </button>
      ) : null}

      {links.length > 1 ? (
        <details className="rounded-2xl border border-border/40 bg-card/50 px-4 py-3 text-xs">
          <summary className="cursor-pointer list-none text-muted-foreground">
            これまでのリンク履歴 ({links.length - 1})
          </summary>
          <ul className="mt-3 space-y-2">
            {links
              .filter((l) => l.id !== activeLink?.id)
              .map((l) => {
                const isExpired =
                  new Date(l.expiresAt).getTime() <= Date.now();
                const status = l.revokedAt
                  ? "取り消し"
                  : isExpired
                    ? "期限切れ"
                    : "有効";
                return (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 text-muted-foreground"
                  >
                    <span className="tabular-nums">
                      {formatExpiry(l.createdAt)}
                    </span>
                    <span className="text-foreground/70">{status}</span>
                    <span className="tabular-nums">{l.viewCount} 回</span>
                  </li>
                );
              })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}/${day}`;
}
