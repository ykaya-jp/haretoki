import Link from "next/link";
import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { requireAdmin } from "@/server/admin";

/**
 * /admin layout — operator-only chrome.
 *
 * Three jobs:
 *   1. Defence-in-depth auth gate. Each /admin/* page already calls
 *      requireAdmin() individually (which 404s non-admins), but adding
 *      it at the layout boundary fails earlier on every nested route
 *      and makes the auth invariant a single, obvious thing in the
 *      tree. requireAdmin() is React-cached, so the duplicate call
 *      from the child page is free.
 *   2. A persistent visual marker that this is the operator surface,
 *      not the couple-facing app — bare HTML chrome, no Editorial
 *      brand colours, plus a deliberately loud "Admin only" banner
 *      so a screenshot of an admin page is not mistaken for the
 *      product.
 *   3. A consistent header with cross-links between /admin/* pages so
 *      the operator does not have to type URLs by hand. Pages are
 *      added here as they ship; /admin/cost is in prod, /admin/audit
 *      is being added by another worker in this round.
 */

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "Admin · %s",
  },
  // Defence-in-depth: explicit per-route noindex even though robots.ts
  // already disallows /admin. Vercel preview URLs sometimes leak past
  // robots.txt, so the meta directive is the second locked door.
  robots: { index: false, follow: false },
};

/**
 * Force dynamic — admin pages must run requireAdmin() per-request, not
 * once at build time. Prior to this, Next.js prerendered /admin/* with
 * the build-time `notFound()` result and Vercel served the cached HTML
 * with status 200, defeating the closed-by-default contract. The auth
 * gate fires correctly when this layout opts out of static rendering.
 */
export const dynamic = "force-dynamic";

const NAV: Array<{ href: string; label: string }> = [
  { href: "/admin/cost", label: "Cost" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/onboarding-funnel", label: "Onboarding" },
  { href: "/admin/family-share", label: "Family share" },
  { href: "/admin/visit-reminders", label: "Reminders" },
  { href: "/admin/partner-l2", label: "Partner L2" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Loud "Admin only" banner — couples will never see this surface
          (requireAdmin 404s them), but a screenshot in a bug report
          should be unmistakable as an internal tool, not the product. */}
      <div
        role="alert"
        aria-label="管理者専用ページ"
        className="flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300"
      >
        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        Admin only · 内部運営ツール
      </div>

      {/* Header — admin identity + cross-links + escape hatch */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[13px]">
          <span className="font-mono font-medium tracking-tight text-foreground">
            Haretoki / Admin
          </span>
          <nav
            aria-label="管理者ナビゲーション"
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="inline-flex min-h-[28px] items-center text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="ml-auto flex items-center gap-3 text-muted-foreground">
            <span className="font-mono">{admin.email}</span>
            <Link
              href="/home"
              prefetch={false}
              className="inline-flex min-h-[28px] items-center rounded-md border border-border px-2 py-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Back to app
            </Link>
          </span>
        </div>
      </header>

      {/* Page content — children render whatever they do; the layout
          deliberately does NOT impose width / padding so existing pages
          (e.g. /admin/cost) keep their own max-w container. */}
      {children}
    </div>
  );
}
