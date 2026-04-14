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
        toast.success("データをダウンロードしました");
      } catch {
        toast.error("ダウンロードに失敗しました。もう一度お試しください");
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
          throw new Error(data.error ?? "削除に失敗しました");
        }
        toast.success("アカウントを削除しました");
        router.replace("/");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "削除に失敗しました";
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
          {isExporting ? "準備しています..." : "データをダウンロード"}
        </button>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/5 active:scale-[0.98]"
        >
          <Trash2 className="h-4 w-4" />
          アカウントを削除
        </button>

        <p className="text-xs text-muted-foreground">
          ダウンロードには、あなたのプロフィール・式場・見学記録・評価・候補・最終決定がすべて含まれます。削除は取り消せません。
        </p>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-[env(safe-area-inset-bottom)] sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="space-y-1">
                <h3
                  id="delete-dialog-title"
                  className="text-base font-medium"
                >
                  アカウントを削除しますか？
                </h3>
                <p className="text-sm text-muted-foreground">
                  プロジェクト・式場・見学記録を含む、あなたに紐づくすべてのデータが完全に削除されます。この操作は取り消せません。
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
