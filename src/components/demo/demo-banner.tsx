import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";

// Subtle gold-tinted banner pinned at the top of every /demo page.
// Communicates "this is a demo" and offers a single primary CTA to /signup.
export function DemoBanner() {
  return (
    <div
      role="status"
      aria-label="デモモード"
      className="sticky top-0 z-40 border-b border-[var(--gold-warm)]/40 bg-[var(--gold-subtle)] backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2.5 sm:px-8">
        <p className="flex items-center gap-2 text-xs leading-relaxed text-foreground sm:text-sm">
          <Sparkles
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-[var(--gold-warm)]"
            strokeWidth={1.75}
          />
          <span>
            これはデモです。気に入ったら
            <span className="hidden sm:inline">右上の</span>
            「はじめる」からどうぞ
          </span>
        </p>
        <Link
          href="/signup"
          prefetch={true}
          className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.97] sm:text-sm"
        >
          はじめる
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
