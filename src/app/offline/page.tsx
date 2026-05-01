import type { Metadata } from "next";
import { OfflineRetryButton } from "@/components/pwa/offline-retry-button";

export const metadata: Metadata = {
  title: "オフラインです",
  description: "電波の届かない場所では一部の機能が使えません。",
  robots: { index: false, follow: false },
};

// No data fetch and no Server-side dynamic API (cookies / headers /
// searchParams), so under Next.js 16 Cache Components the page is
// automatically prerendered as static HTML. The service worker pre-
// caches /offline on install (`SHELL_ASSETS` in public/sw.js).
export default function OfflinePage() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          aria-hidden="true"
          className="opacity-90"
        >
          <defs>
            <radialGradient id="offline-sun" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--gold-warm)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--gold-warm)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="36" cy="36" r="28" fill="url(#offline-sun)" />
          <path
            d="M12 44 Q 24 38 36 42 T 60 40"
            stroke="var(--muted-foreground)"
            strokeWidth="1.25"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M16 52 Q 30 48 44 50 T 58 48"
            stroke="var(--muted-foreground)"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.35"
          />
        </svg>
        <div className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-[24px] font-light leading-[1.45] tracking-[-0.01em]">
            少し、雲がかかっています
          </h1>
          <p className="text-[14px] leading-[1.7] text-muted-foreground">
            電波が届くところで、もう一度ひらいてみてください。
            <br />
            候補や見学メモは、つながり次第まとめて反映されます。
          </p>
        </div>
        <OfflineRetryButton />
      </div>
    </main>
  );
}
