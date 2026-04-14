import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { createClient } from "@/lib/supabase/server";
import { deleteUserAccount } from "@/server/actions/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  confirm: z.literal(true),
  email: z.string().email(),
});

// GDPR Article 17 — Right to erasure.
// Destructive endpoint. Requires two independent guards:
//   1. `confirm: true` must be present in the body.
//   2. `email` must match the authenticated user's email (typed in the UI).
// Both guards must pass or we return 400 without touching any data.
export async function DELETE(req: NextRequest) {
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

  // Clear the Supabase session so the client isn't left with a half-valid
  // cookie pointing at a deleted Prisma row. signOut uses the user's own
  // access token (no admin SDK needed); if it fails we still proceed since
  // the DB rows are already gone.
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Intentional: DB deletion already succeeded; client will redirect.
  }

  return NextResponse.json({ success: true });
}
