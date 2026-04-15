"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { acceptInvitation } from "@/server/actions/invitations";
import { Users } from "lucide-react";

interface AcceptInviteFormProps {
  invitationId: string;
}

export function AcceptInviteForm({ invitationId }: AcceptInviteFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptInvitation(invitationId);
      if (result.success) {
        toast.success("ふたりの式場さがしに合流しました");
        router.push("/home");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="space-y-4 p-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          合流すると、式場の閲覧・評価・比較を一緒に進められます。
          見学メモや「本命」もふたりで共有できます。
        </p>
        <Button
          onClick={handleAccept}
          disabled={isPending}
          className="h-11 w-full"
        >
          {isPending ? "合流しています…" : "合流する"}
        </Button>
      </CardContent>
    </Card>
  );
}
