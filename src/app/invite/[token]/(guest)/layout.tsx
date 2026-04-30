import type { ReactNode } from "react";

/**
 * Level 1 Guest layout — intentionally minimal (no bottom nav, no coach
 * chat bar, no authed providers). The guest is read-only and we must NOT
 * load hooks that expect a Supabase session.
 *
 * Visual chrome:
 *   - soft --gradient-dawn background (cream → rose-subtle)
 *   - max-width 400px, mobile-first
 *   - sr-only announcement so screen readers know this is a guest view
 */
export default function GuestLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh"
      style={{
        background: "var(--gradient-dawn, var(--background))",
      }}
    >
      <span className="sr-only" role="note">
        相棒さんとしてご覧になっています。閲覧のみ可能です。
      </span>
      <div className="mx-auto w-full max-w-[400px] px-6 py-8">{children}</div>
    </div>
  );
}
