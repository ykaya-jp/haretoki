/**
 * Emergency admin tool — confirm a user's email + (optionally) reset
 * their password via the Supabase admin API.
 *
 * USE CASE: prod email delivery is broken (free-tier SMTP rate-limit /
 * misconfig) and registered users can't sign in because:
 *   - Their `email_confirmed_at` is null (signup confirmation never
 *     reached them) → Supabase returns invalid_credentials on signin
 *   - /forgot-password emails also never arrive
 *
 * Run locally where SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
 * (in .env.local or pulled from `vercel env pull --environment production`).
 *
 *   npx tsx scripts/admin-fix-user.ts <email> [new-password]
 *
 * Examples:
 *   # Just confirm the email (existing password preserved):
 *   npx tsx scripts/admin-fix-user.ts user@example.com
 *
 *   # Confirm email AND reset password:
 *   npx tsx scripts/admin-fix-user.ts user@example.com 'newPassword123!'
 *
 * The script never prints existing user data (no PII leak); only the
 * fix outcome.
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local first, then .env (lower priority)
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
  );
  console.error(
    "Hint: run `vercel env pull .env.local --environment production --yes` first",
  );
  process.exit(1);
}

const [, , email, newPassword] = process.argv;

if (!email || !email.includes("@")) {
  console.error("Usage: npx tsx scripts/admin-fix-user.ts <email> [new-password]");
  console.error("Email argument is required and must contain @");
  process.exit(1);
}

const adminHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function findUserByEmail(email: string): Promise<{ id: string; email: string; email_confirmed_at: string | null } | null> {
  // The admin/users endpoint supports `email=eq.X` filter via PostgREST-style query
  const r = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: adminHeaders },
  );
  if (!r.ok) {
    throw new Error(`admin/users lookup failed: ${r.status} ${await r.text()}`);
  }
  const data = (await r.json()) as { users?: Array<{ id: string; email: string; email_confirmed_at: string | null }> };
  const user = data.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user ?? null;
}

async function updateUser(
  userId: string,
  body: { email_confirm?: boolean; password?: string },
): Promise<void> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminHeaders,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    throw new Error(`updateUser failed: ${r.status} ${await r.text()}`);
  }
}

async function main() {
  console.log(`Looking up user: ${email}`);
  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`✗ User not found in this Supabase project (${SUPABASE_URL})`);
    console.error("  → email is on a DIFFERENT project, or never registered here");
    process.exit(1);
  }

  console.log(`✓ Found user (id: ${user.id.slice(0, 8)}…)`);
  console.log(
    `  email_confirmed_at: ${user.email_confirmed_at ? "set ✓" : "null (BLOCKING SIGNIN)"}`,
  );

  const update: { email_confirm?: boolean; password?: string } = {};
  if (!user.email_confirmed_at) {
    update.email_confirm = true;
  }
  if (newPassword) {
    if (newPassword.length < 8) {
      console.error("✗ Password must be 8+ chars");
      process.exit(1);
    }
    update.password = newPassword;
  }

  if (Object.keys(update).length === 0) {
    console.log("⊘ Nothing to update — email already confirmed and no new password provided");
    console.log("  Try signing in with the existing password.");
    return;
  }

  await updateUser(user.id, update);

  console.log("✓ Update applied:");
  if (update.email_confirm) console.log("  - email confirmed");
  if (update.password) console.log("  - password reset");
  console.log("\nNow sign in at https://haretoki.vercel.app/login with the email + " +
    (newPassword ? "the new password" : "the existing password"));
}

main().catch((err) => {
  console.error("\n✗ Script failed:");
  console.error(err.message ?? err);
  process.exit(1);
});
