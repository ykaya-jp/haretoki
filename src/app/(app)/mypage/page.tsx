import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { SettingsForm } from "@/components/settings/settings-form";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { NameEdit } from "@/components/mypage/name-edit";
import { Settings, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function MyPage() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const [members, project] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { conditions: true },
    }),
  ]);

  const hasPartner = members.some((m) => m.role === "partner" && m.acceptedAt);
  const partner = members.find((m) => m.role === "partner");

  const conditions = (project?.conditions ?? {}) as {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  };

  const ownerName =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  return (
    <div className="space-y-12">
      <h2 className="font-serif text-2xl font-light">マイページ</h2>

      {/* Profile */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-light tracking-wide">
          プロフィール
        </h3>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">お名前</p>
            <div className="mt-1">
              <NameEdit currentName={ownerName} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">メールアドレス</p>
            <p className="mt-1 font-medium">{user.email}</p>
          </div>
        </div>
      </section>

      {/* Partner */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-light tracking-wide">
          パートナー
        </h3>
        {hasPartner ? (
          <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
            <p className="text-xs text-muted-foreground">パートナー</p>
            <p className="mt-1 font-medium">{partner?.user.name ?? partner?.user.email}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--gold-subtle)] px-2.5 py-0.5 text-xs text-[var(--gold-warm)]">
              一緒に参加中
            </span>
          </div>
        ) : (
          <PartnerInvite
            inviteLink={`${process.env.APP_URL ?? "https://haretoki.vercel.app"}/accept-invite?project=${projectId}`}
            partnerStatus={partner ? "invited" : "not_invited"}
          />
        )}
      </section>

      {/* Conditions */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-light tracking-wide">
          おふたりの希望
        </h3>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <SettingsForm initialConditions={conditions} />
        </div>
      </section>

      {/* Link to Settings */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-light tracking-wide">
          その他
        </h3>
        <Link
          href="/settings"
          prefetch
          className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">設定</p>
              <p className="text-xs text-muted-foreground">テーマ・通知・ログアウト</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}
