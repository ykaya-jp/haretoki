import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getPendingInvitation } from "@/server/actions/invitations";
import { Toaster } from "@/components/ui/sonner";
import { AcceptInviteForm } from "./accept-invite-form";
import AcceptInviteLoading from "./loading";

export const metadata: Metadata = {
  title: "招待を確認",
  description:
    "おふたりのプロジェクトに招かれました。短いひとつの確認で、ふたりの式場選びに合流できます。",
  // The invite acceptance flow is per-recipient and short-lived; we
  // don't want it surfaced in search and we don't want crawlers
  // following the form into a redirect loop.
  robots: { index: false, follow: false },
};

async function AcceptInviteContent() {
  // Under cacheComponents (PPR) any route that reads cookies / auth must
  // opt into dynamic rendering; `connection()` is the cacheComponents-safe
  // equivalent of `export const dynamic = "force-dynamic"` (which Next 16
  // rejects when cacheComponents is on). Without this, the static
  // prerender fails at build and the error boundary takes over at runtime.
  await connection();
  const invitation = await getPendingInvitation();

  if (!invitation) {
    redirect("/");
  }

  // Route lives at the app root (not inside `(app)` layout) so partner
  // invitees never trigger getOrCreateProject before they've accepted
  // the invite — that was the root cause of the 500 loop. The root
  // layout doesn't bring a Toaster, so we mount one inline.
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)]">
          Haretoki
          <span aria-hidden="true" className="mx-2 opacity-30">·</span>
          <span className="text-muted-foreground">Invitation</span>
        </p>
        <div
          aria-hidden="true"
          className="mx-auto h-px w-24"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 45%, transparent) 50%, transparent 100%)",
          }}
        />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light tracking-[0.01em]">
            ふたりの式場さがしに、招待が届いています
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            「{invitation.projectName}」に招ばれました。
            <br />
            パートナーとして一緒に、式場を見ていきませんか。
          </p>
        </div>
        <AcceptInviteForm invitationId={invitation.id} />
      </div>
      <Toaster position="bottom-center" />
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<AcceptInviteLoading />}>
      <AcceptInviteContent />
    </Suspense>
  );
}
