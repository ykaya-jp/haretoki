import Link from "next/link";

/**
 * SiteFooter — single source of truth for the in-app footer.
 *
 * Placement: rendered once at the bottom of the (app) layout's <main>
 * boundary, so every authenticated screen surfaces support / legal
 * links exactly once at scroll-end without competing with the
 * fixed BottomNav.
 *
 * Why a Server Component: the footer is purely a navigation island —
 * no state, no event handlers, no theme JS. Keeping it server-side
 * trims the client bundle and lets <Link prefetch={false}> defer
 * fetching legal pages until they are actually tapped (these are
 * one-time-read surfaces, not repeated navigation).
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      aria-label="サイトフッター"
      className="mx-auto mt-16 max-w-5xl px-5 pb-8 pt-10 text-muted-foreground sm:px-8"
    >
      {/* Hairline above the footer block — same gold-fade treatment as
          venue-header so the boundary feels editorial, not utilitarian. */}
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--gold-warm)_20%,transparent)] to-transparent"
      />

      <nav
        aria-label="サイト内の案内"
        className="mt-8 flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
      >
        <Link
          href="/support"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-3 text-[13px] tracking-wide transition-colors duration-200 hover:text-foreground underline-offset-4 hover:underline"
        >
          サポート窓口
        </Link>
        <span aria-hidden="true" className="hidden text-border sm:inline">
          ·
        </span>
        <Link
          href="/terms"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-3 text-[13px] tracking-wide transition-colors duration-200 hover:text-foreground underline-offset-4 hover:underline"
        >
          利用規約
        </Link>
        <span aria-hidden="true" className="hidden text-border sm:inline">
          ·
        </span>
        <Link
          href="/privacy"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center px-3 text-[13px] tracking-wide transition-colors duration-200 hover:text-foreground underline-offset-4 hover:underline"
        >
          プライバシーポリシー
        </Link>
      </nav>

      <p className="mt-6 px-3 text-[11px] tabular-nums tracking-[0.08em] text-muted-foreground/60">
        © {year} Haretoki — おふたりの「選ぶ」を、晴れの日へ。
      </p>
    </footer>
  );
}
