import { createBrowserClient } from "@supabase/ssr";
import { sanitiseSupabaseEnv } from "@/lib/supabase/env";

/**
 * Browser-side Supabase client factory.
 *
 * URL/key sanitation lives in `env.ts` so server / middleware /
 * browser all run the same paranoid trim. See env.ts for the full
 * "why" — short version: a previous Vercel env-var entry held literal
 * `\n` and the URL parser turned that into `/n` in the request path.
 */
export function createClient() {
  const { url, anonKey } = sanitiseSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
