"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function DataManagement({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const handleExport = () => {
    startExport(async () => {
      try {
        const res = await fetch("/api/user/export", { method: "GET" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const date = new Date().toISOString().slice(0, 10);
        const a = document.createElement("a");
        a.href = url;
        a.download = `haretoki-data-${date}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("記録をダウンロードしました");
      } catch {
        toast.error("ダウンロードがうまくいきませんでした。もう一度お試しください");
      }
    });
  };

  const handleDelete = () => {
    if (emailInput.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      toast.error("メールアドレスが一致しません");
      return;
    }
    startDelete(async () => {
      try {
        const res = await fetch("/api/user/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true, email: emailInput.trim() }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "うまく消せませんでした");
        }
        toast.success("アカウントを消しました");
        router.replace("/");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "うまく消せませんでした";
        toast.error(msg);
      }
    });
  };

  const confirmReady =
    emailInput.trim().toLowerCase() === userEmail.trim().toLowerCase();

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          aria-busy={isExporting}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "準備しています…" : "記録をダウンロード"}
        </button>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/5 active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
          アカウントを消す
        </button>

        <p className="text-xs text-muted-foreground">
          ダウンロードには、お名前・式場・見学記録・評価・候補・決めた場所のすべてが含まれます。消すと戻せません。
        </p>
      </div>

      {confirmOpen && (
        // a11y: dialog wrapper has onKeyDown for Escape; the static
        // analyzer doesn't accept role=dialog as interactive.
        // Real-button backdrop sits inside, see below.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          // Esc dismisses on top of the explicit cancel button, matching
          // the WCAG "no-keyboard-trap" expectation for modal dialogs.
          // Wrapped in keyDown so screen-reader users with no pointer can
          // close the dialog without tabbing all the way to the cancel
          // button.
          onKeyDown={(e) => {
            if (e.key === "Escape" && !isDeleting) setConfirmOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-[env(safe-area-inset-bottom)] sm:items-center"
        >
          {/* Backdrop button — captures the dismiss tap as a real
              keyboard-accessible control rather than a non-interactive
              div with onClick (which is unreachable via Tab). */}
          <button
            type="button"
            aria-label="ダイアログを閉じる"
            disabled={isDeleting}
            onClick={() => setConfirmOpen(false)}
            className="absolute inset-0 bg-black/40"
            tabIndex={-1}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="space-y-1">
                <h3
                  id="delete-dialog-title"
                  className="text-base font-medium"
                >
                  アカウントを消しますか？
                </h3>
                <p className="text-sm text-muted-foreground">
                  式場・見学記録・これまでの会話を含む、おふたりの式場さがしに関わるすべての中身が完全に消えます。この操作は戻せません。
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <label
                htmlFor="confirm-email"
                className="text-xs text-muted-foreground"
              >
                確認のため、登録メールアドレス（{userEmail}）を入力してください
              </label>
              <input
                id="confirm-email"
                type="email"
                autoComplete="off"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                disabled={isDeleting}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
                placeholder={userEmail}
              />
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDeleting}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || !confirmReady}
                aria-busy={isDeleting}
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-destructive px-4 py-3 text-sm text-destructive-foreground transition-colors hover:bg-destructive/90 active:scale-[0.98] disabled:opacity-50"
              >
                {isDeleting ? "削除しています..." : "完全に削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
