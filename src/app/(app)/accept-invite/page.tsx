import { redirect } from "next/navigation";
import { getPendingInvitation } from "@/server/actions/invitations";
import { AcceptInviteForm } from "./accept-invite-form";

export default async function AcceptInvitePage() {
  const invitation = await getPendingInvitation();

  if (!invitation) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="text-xl">プロジェクトへの招待</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            「{invitation.projectName}」に招待されています
          </p>
        </div>

        <AcceptInviteForm invitationId={invitation.id} />
      </div>
    </div>
  );
}
