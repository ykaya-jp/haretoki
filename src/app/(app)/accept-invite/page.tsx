import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getPendingInvitation } from "@/server/actions/invitations";
import { AcceptInviteForm } from "./accept-invite-form";
import AcceptInviteLoading from "./loading";

async function AcceptInviteContent() {
  const invitation = await getPendingInvitation();

  if (!invitation) {
    redirect("/");
  }

  return (
    <div className="flex min-h-[60dvh] items-center justify-center px-4">
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
