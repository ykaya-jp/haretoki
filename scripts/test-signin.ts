/**
 * Direct Supabase auth API probe — bypasses supabase-js / supabase-ssr
 * entirely. Confirms whether the auth server itself accepts the
 * credentials, isolating "library / cookie issue" from "credential /
 * server issue".
 *
 *   npx tsx scripts/test-signin.ts <email> <password>
 *
 * Output cases:
 *   - 200 + access_token → API works, problem is client-side (cookies,
 *     supabase-ssr, CSP, etc.). Login UI may still fail; library issue
 *   - 400 invalid_credentials → password really doesn't match what's in
 *     auth.users. Use admin-fix-user.ts to overwrite password
 *   - 400 email_not_confirmed → email_confirmed_at is null. Use
 *     admin-fix-user.ts to force confirm
 *   - 400 with other error_code → log it
 *   - 401 → ANON KEY rejected (env issue)
 *   - 5xx → Supabase backend issue
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!URL || !ANON_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be in .env.local",
  );
  console.error(
    "Hint: vercel env pull .env.local --environment production --yes",
  );
  process.exit(1);
}

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error(
    "Usage: npx tsx scripts/test-signin.ts <email> <password>",
  );
  process.exit(1);
}

async function main() {
  console.log(`Target URL: ${URL}`);
  console.log(`ANON KEY format: ${ANON_KEY!.startsWith("sb_publishable_") ? "NEW (sb_publishable_*)" : ANON_KEY!.startsWith("eyJ") ? "JWT (legacy)" : "UNKNOWN"}`);
  console.log(`ANON KEY length: ${ANON_KEY!.length}`);
  console.log(`Email being tested: ${email}`);
  console.log(`Password length: ${password.length}`);
  // Surface any invisible whitespace that browser autofill / paste can introduce
  const trimmed = password.trim();
  if (trimmed.length !== password.length) {
    console.warn(
      `⚠ password has ${password.length - trimmed.length} leading/trailing whitespace characters`,
    );
  }
  console.log();

  console.log("→ Calling /auth/v1/token?grant_type=password directly…\n");
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  console.log(`HTTP status: ${r.status}`);
  const body = await r.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    // body is plain text
  }

  if (r.ok) {
    console.log("\n✓ Sign-in SUCCEEDED at API level");
    console.log("  → Server / credentials are FINE");
    console.log("  → If the login UI still fails, problem is client-side");
    console.log("    (supabase-ssr session cookie, CSP blocking, etc.)");
    if (parsed.access_token) {
      console.log(`  access_token (truncated): ${String(parsed.access_token).slice(0, 20)}...`);
    }
    if (parsed.user) {
      const u = parsed.user as { id?: string; email_confirmed_at?: string | null };
      console.log(`  user.id: ${u.id?.slice(0, 8)}…`);
      console.log(`  email_confirmed_at: ${u.email_confirmed_at ?? "null"}`);
    }
    return;
  }

  console.log("\n✗ Sign-in FAILED at API level");
  console.log(`  error_code: ${parsed.error_code ?? "?"}`);
  console.log(`  msg: ${parsed.msg ?? parsed.error_description ?? body.slice(0, 200)}`);
  console.log();
  switch (parsed.error_code) {
    case "invalid_credentials":
      console.log("  → Password really doesn't match auth.users.encrypted_password");
      console.log("  → Or email is on a DIFFERENT Supabase project");
      console.log("  → Fix: npx tsx scripts/admin-fix-user.ts <email> 'newPassword'");
      break;
    case "email_not_confirmed":
      console.log("  → email_confirmed_at is null for this account");
      console.log("  → Fix: npx tsx scripts/admin-fix-user.ts <email>");
      break;
    case "over_request_rate_limit":
    case "too_many_requests":
      console.log("  → Rate-limited. Wait 5-10 min");
      break;
    default:
      console.log("  → Unexpected error code. Investigate manually");
  }
}

main().catch((err) => {
  console.error("\n✗ Probe failed:");
  console.error(err.message ?? err);
  console.error("(network / DNS issue?)");
  process.exit(1);
});
