"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h2 className="text-lg font-bold">予期しないエラーが発生しました</h2>
          <p className="mt-2 text-sm text-gray-500">
            ページを再読み込みしてください
          </p>
          <button
            onClick={reset}
            className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-sm text-white"
          >
            再読み込み
          </button>
        </div>
      </body>
    </html>
  );
}
