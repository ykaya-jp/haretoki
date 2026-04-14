"use client";

import { useEffect, useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== "undefined" && "onLine" in navigator
      ? !navigator.onLine
      : false,
  );

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <html lang="ja">
      <body className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md text-center">
          <h2 className="text-lg font-light">
            {offline ? "オフラインです" : "予期しないエラーが発生しました"}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {offline
              ? "ネットワーク接続を確認してください"
              : "ページを再読み込みしてください"}
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={reset}
              className="rounded-lg bg-blue-900 px-4 py-2 text-sm text-white"
            >
              再読み込み
            </button>
            <a
              href="/home"
              className="text-sm text-blue-900 underline underline-offset-2"
            >
              ホームに戻る
            </a>
            <a
              href="mailto:support@haretoki.app"
              className="text-xs text-gray-500 underline underline-offset-2"
            >
              お問い合わせ
            </a>
          </div>
          {error.digest && (
            <p className="mt-3 text-[10px] tabular-nums text-gray-400">
              エラーID: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
