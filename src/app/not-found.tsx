import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "見つかりません",
  description: "お探しのページが見つかりませんでした。",
};

/**
 * Root-level 404 page. Next.js renders its own default wall of text
 * without this file, which looks broken to a couple who mis-tapped a
 * URL or followed a stale link. This gives them a gentle way back.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-6 text-center">
      <div className="space-y-3">
        <p className="text-eyebrow text-muted-foreground">
          Haretoki · 404
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(22px,6vw,28px)] font-light leading-[1.35] tracking-[-0.005em]">
          そのページは、見つかりませんでした
        </h1>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground max-w-[320px] mx-auto">
          URL が変わったか、もともと無いページかもしれません。ホームに戻って、もう一度はじめましょう。
        </p>
      </div>
      {/* Two-path CTA — couples reaching this page may or may not be
          authenticated. /home redirects unauthenticated visitors to /login,
          which means a stale-link visitor would bounce twice before seeing
          anything actionable. Offer / (the public landing) as a direct
          path so first-time arrivals find the entry point on one tap. */}
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/home"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
        >
          ホームへ戻る
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border px-6 text-sm text-muted-foreground transition-colors hover:text-foreground active:scale-[0.98]"
        >
          Haretoki について
        </Link>
      </div>
    </div>
  );
}
