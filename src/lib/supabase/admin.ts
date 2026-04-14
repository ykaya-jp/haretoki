import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase admin client scoped to the service role.
 *
 * Use ONLY on the server, and ONLY for operations that the normal user-scoped
 * client cannot perform (auth user deletion, cross-tenant admin queries).
 * Never import this from a Client Component or expose it through a public
 * endpoint that doesn't already authenticate the caller.
 *
 * Returns null when `SUPABASE_SERVICE_ROLE_KEY` is not configured so callers
 * can degrade gracefully (e.g., skip Supabase auth cleanup but still delete
 * the Prisma rows — better than throwing 500 on the user).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
