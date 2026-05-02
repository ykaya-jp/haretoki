/**
 * Admin authorisation helper.
 *
 * Phase 2 商用化フェーズの内部 dashboard (`/admin/cost` ほか) を、
 * 開発者本人だけが触れる軽量ガードで囲うためのモジュール。
 *
 * 認可方針:
 *   - 1 人開発フェーズなので RBAC は要らない
 *   - `ADMIN_EMAILS` (コンマ区切り環境変数) のリストに、認証済 user.email
 *     が完全一致するかどうかで判断 (純粋なロジックは `src/lib/admin-allowlist.ts`)
 *   - env が未設定 / 該当なし → admin ページは 404 で隠す (403 だと
 *     「ここに admin 機能があるが入れない」というシグナルを露出してしまう)
 *
 * 商用化規模が拡大して 「admin 権限を持つ複数人」が必要になったら
 * Supabase の `app_metadata.role` を見るパスへ移行する。
 */

import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin-allowlist";

export { isAdminEmail };

/**
 * Page-level guard. Throws Next.js's notFound() (renders the global
 * 404) for both unauthenticated visitors AND authenticated non-admin
 * users. Pages that need admin must `await requireAdmin()` as the
 * first thing in the Server Component body — that triggers the 404
 * *before* any other DB read happens, so a leak-by-error-boundary is
 * impossible.
 *
 * IMPORTANT: We deliberately do NOT call requireUser() here. That
 * helper redirects to /login on unauth, which leaks the existence of
 * /admin/* (a 302 to /login is a fingerprint that the URL exists).
 * Phase 3 e2e (phase3-integration.spec.ts) expects 404 for unauth +
 * non-admin alike — the enumeration-mitigation contract documented
 * at the top of this file. Use Supabase getUser() directly so unauth
 * lands in the same notFound() branch as wrong-email.
 */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    // Lazy import notFound so this module stays usable in non-app
    // contexts (tests, scripts) without dragging in next/navigation.
    const { notFound } = await import("next/navigation");
    // notFound() throws an internal Next.js redirect signal — control
    // never returns here. The `throw` after is unreachable but keeps
    // TS happy about the `user` narrowing below.
    notFound();
    throw new Error("unreachable");
  }
  return { userId: user.id, email: user.email ?? "" };
}
