/**
 * Pure admin allow-list helper. Lives in `src/lib/` (not `src/server/`)
 * so test files can import it without dragging the Prisma + Supabase
 * runtime in. The Server-Component-only guard (`requireAdmin`) lives
 * in `src/server/admin.ts` and re-uses this same predicate.
 */

/** Returns the lower-cased admin email allow-list. Empty array if unset. */
function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true when the email string is in the allow-list. Comparison
 * is case-insensitive on both sides; an empty / unset / null email is
 * never an admin (closed by default).
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
