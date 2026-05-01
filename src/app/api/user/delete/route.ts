import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserAccount } from "@/server/actions/user-data";
import { detectBot } from "@/lib/botid";


const BodySchema = z.object({
  confirm: z.literal(true),
  email: z.string().email(),
});

// GDPR Article 17 — Right to erasure.
// Destructive endpoint. Requires three independent guards:
//   1. Vercel BotID gate (block automated takeover attempts before any
//      auth check spends a Supabase RLS lookup).
//   2. `confirm: true` must be present in the body.
//   3. `email` must match the authenticated user's email (typed in the UI).
// All three guards must pass or we return without touching any data.
export async function DELETE(req: NextRequest) {
  const bot = await detectBot("user-delete");
  if (bot.blocked) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = await requireUser();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "リクエスト本文が不正です" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "削除の確認情報が不足しています" },
      { status: 400 },
    );
  }

  const userEmail = user.email ?? "";
  if (
    !userEmail ||
    parsed.data.email.trim().toLowerCase() !== userEmail.trim().toLowerCase()
  ) {
    return NextResponse.json(
      { error: "入力されたメールアドレスが一致しません" },
      { status: 400 },
    );
  }

  await deleteUserAccount(prisma, user.id);

  // Delete the Supabase Auth user too. Without this, the auth account would
  // survive DB deletion and the same email could sign back in to a zombie
  // state (valid auth cookie, missing Prisma rows → every Server Action
  // fails). Requires SUPABASE_SERVICE_ROLE_KEY; without it we log and
  // continue so local/dev environments without admin credentials still work
  // (the Prisma rows are gone and sign-out clears the cookie).
  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("supabase admin.deleteUser failed:", {
        userId: user.id,
        error: error.message,
      });
    }
  } else {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not set — skipping Supabase Auth user deletion. " +
        "Prisma rows were deleted but the auth account still exists.",
    );
  }

  // Clear the Supabase session so the client isn't left with a half-valid
  // cookie pointing at a deleted Prisma row.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Intentional: DB deletion already succeeded; client will redirect.
  }

  return NextResponse.json({ success: true });
}
