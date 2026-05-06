/**
 * Centralised, paranoid Supabase env-var sanitiser.
 *
 * History: a previous Vercel env-var entry left literal `\n` (backslash
 * + n) at the end of NEXT_PUBLIC_SUPABASE_URL. The build embedded that
 * value into client + server bundles. WHATWG URL parsing rewrote `\` to
 * `/` so every fetch hit `https://<ref>.supabase.co/n/auth/v1/...`,
 * which the gateway 404'd with no CORS headers — every login attempt
 * surfaced as `AuthRetryableFetchError: Failed to fetch` in the
 * browser.
 *
 * This helper is the single place every Supabase client construction
 * passes its env through, so the same sanitation runs on:
 *   - browser client (`src/lib/supabase/client.ts`)
 *   - server client  (`src/lib/supabase/server.ts`)
 *   - middleware     (`src/lib/supabase/middleware.ts`)
 *
 * Strip rules (cheap, deterministic):
 *   - `.trim()` whitespace
 *   - tail literal escape pairs (`\n` `\r` `\t` etc) — paste accidents
 *   - tail `/` and `\` — gateway is path-relative aware but we don't
 *     want a stray slash either
 *
 * Throws when the var is missing entirely so a misconfig fails loudly
 * at boot rather than silently falling back to undefined and producing
 * a confusing "fetch to undefined/auth/v1/..." error later.
 */
export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

function cleanUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\\[nrt]+$/g, "")
    .replace(/[\\/]+$/g, "");
}

export function sanitiseSupabaseEnv(): SupabaseEnv {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }
  if (!rawKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined");
  }

  return { url: cleanUrl(rawUrl), anonKey: rawKey.trim() };
}

/**
 * Optional admin (service-role) variant. Returns null when the service
 * role key isn't configured so callers can degrade gracefully — the
 * same null-when-missing contract the legacy createAdminClient had.
 */
export interface SupabaseAdminEnv {
  url: string;
  serviceKey: string;
}

export function sanitiseSupabaseAdminEnv(): SupabaseAdminEnv | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !rawKey) return null;
  return { url: cleanUrl(rawUrl), serviceKey: rawKey.trim() };
}
