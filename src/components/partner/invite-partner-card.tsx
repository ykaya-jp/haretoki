"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { invitePartner } from "@/server/actions/invitations";
import { Users, Clock, CheckCircle2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface PartnerStatus {
  id: string;
  email: string;
  name: string | null;
  accepted: boolean;
  invitedAt: Date;
  acceptedAt: Date | null;
}

interface InvitePartnerCardProps {
  partnerStatus: PartnerStatus | null;
}

export function InvitePartnerCard({ partnerStatus }: InvitePartnerCardProps) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    startTransition(async () => {
      const result = await invitePartner(email);
      if (result.success) {
        toast.success("招待を送信しました");
        setEmail("");
      } else {
        toast.error(result.error);
      }
    });
  }

  // Partner accepted
  if (partnerStatus?.accepted) {
    return (
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <Users className="h-5 w-5 text-primary" />
            パートナー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {partnerStatus.name || partnerStatus.email}
              </p>
              {partnerStatus.name && (
                <p className="truncate text-xs text-muted-foreground">
                  {partnerStatus.email}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
              連携中
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Partner invited but not yet accepted
  if (partnerStatus && !partnerStatus.accepted) {
    return (
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-serif text-base">
            <Users className="h-5 w-5 text-primary" />
            パートナー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">招待中</p>
              <p className="truncate text-xs text-muted-foreground">
                {partnerStatus.email}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              承諾待ち
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No partner — show invite form
  return (
    <Card className="shadow-[var(--shadow-soft)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-base">
          <Users className="h-5 w-5 text-primary" />
          パートナーを招待
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          パートナーのメールアドレスを入力して招待しましょう。式場の評価や比較を一緒に進められます。
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="partner-email" className="sr-only">
              メールアドレス
            </Label>
            <Input
              id="partner-email"
              type="email"
              placeholder="partner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className={cn("h-11")}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={isPending || !email.trim()}
            className="h-11 shrink-0"
          >
            <Send className="mr-1.5 h-4 w-4" />
            招待する
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
