import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Heart } from "lucide-react";
import { listFamilyInvitations } from "@/server/actions/family-invitations";
import { FamilyShareManager } from "@/components/family/family-share-manager";

export const metadata: Metadata = {
  title: "家族に伝える",
  description: "決まった式場をご家族に共有するためのリンクを管理します。",
};

/**
 * Track C-1: family share management — owner-only.
 *
 * Lists existing family-share links with badges (active / expired /
 * revoked) and lets the owner issue / revoke. The actual share UX
 * (native share sheet, copy fallback) lives inside
 * `FamilyShareManager` so the server-rendered shell stays cache-safe.
 */
export default async function FamilyShareSettingsPage() {
  const links = await listFamilyInvitations();

  return (
    <div className="space-y-8 pb-[env(safe-area-inset-bottom)]">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <Link
            href="/mypage"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Family Share</span>
        </p>
        <h1 className="mt-2 inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-h1 font-light tracking-[-0.01em]">
          <Heart
            className="h-5 w-5 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          家族に伝える
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          決まった式場の見どころだけを、 ご家族と共有できる
          <br />
          read-only リンクをお作りします。 費用や個別メモは共有されません。
        </p>
      </header>

      <FamilyShareManager initialLinks={links} />

      <section
        aria-labelledby="family-share-faq"
        className="space-y-3 rounded-2xl bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground"
      >
        <h2
          id="family-share-faq"
          className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
        >
          このリンクについて
        </h2>
        <ul className="space-y-2">
          <li>
            ・ <strong className="font-medium">30 日</strong>で自動的に
            期限切れになります。
          </li>
          <li>
            ・ いつでも「リンクを取り消す」で 共有を止められます。
          </li>
          <li>
            ・ 同じプロジェクトで新しいリンクを発行すると、 前のリンクは
            自動的に無効になります。
          </li>
          <li>
            ・ ご家族が見られるのは「式場名・所在地・主な見どころ・選んだ理由」
            だけです。 費用や見学メモは含まれません。
          </li>
        </ul>
      </section>
    </div>
  );
}
