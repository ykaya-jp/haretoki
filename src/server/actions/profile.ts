"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";

/**
 * Update the user's display name stored in Supabase Auth user_metadata.name.
 * Also mirrors into prisma.user.name so server-side project queries stay consistent.
 * Trims and caps at 50 characters; empty is rejected.
 */
export async function updateDisplayName(
  name: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmed = name.trim().slice(0, 50);
  if (!trimmed) {
    return { success: false, error: "名前を入力してください" };
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { name: trimmed } });
  if (error) {
    return { success: false, error: error.message };
  }

  // Keep the DB mirror in sync (best-effort — auth metadata is source of truth for display)
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { name: trimmed },
    });
  } catch {
    // Ignore if user row is not yet present; greeting uses auth metadata regardless
  }

  revalidatePath("/mypage");
  revalidatePath("/home");
  return { success: true };
}
