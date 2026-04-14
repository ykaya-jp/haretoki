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
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--gold-warm)]">
          Haretoki
        </p>
        <div>
          <h1>プロジェクトへの招待</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            「{invitation.projectName}」に招待されています。
            パートナーとして式場選びに参加しましょう。
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
