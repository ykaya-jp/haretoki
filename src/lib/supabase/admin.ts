import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sanitiseSupabaseAdminEnv } from "@/lib/supabase/env";

/**
 * Supabase admin client scoped to the service role.
 *
 * Use ONLY on the server, and ONLY for operations that the normal user-scoped
 * client cannot perform (auth user deletion, cross-tenant admin queries,
 * Storage uploads bypassing RLS).
 * Never import this from a Client Component or expose it through a public
 * endpoint that doesn't already authenticate the caller.
 *
 * Returns null when `SUPABASE_SERVICE_ROLE_KEY` is not configured so callers
 * can degrade gracefully.
 *
 * URL/key go through `sanitiseSupabaseAdminEnv()` — see env.ts for the
 * "why we trim trailing \n" history.
 */
export function createAdminClient() {
  const env = sanitiseSupabaseAdminEnv();
  if (!env) return null;
  return createSupabaseClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
