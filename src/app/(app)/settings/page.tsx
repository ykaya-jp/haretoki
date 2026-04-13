import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { SettingsForm } from "@/components/settings/settings-form";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { LogoutButton } from "@/components/settings/logout-button";

export default async function SettingsPage() {
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

  return (
    <div className="space-y-8">
      <h2>設定</h2>

      {/* Profile */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">プロフィール</h3>
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">メールアドレス</p>
          <p className="font-medium">{user.email}</p>
        </div>
      </section>

      {/* Partner */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">パートナー</h3>
        {hasPartner ? (
          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted-foreground">パートナー</p>
            <p className="font-medium">{partner?.user.name ?? partner?.user.email}</p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">参加済み</p>
          </div>
        ) : (
          <PartnerInvite
            inviteLink={`${process.env.APP_URL ?? "https://venuelens.vercel.app"}/accept-invite?project=${projectId}`}
            partnerStatus={partner ? "invited" : "not_invited"}
          />
        )}
      </section>

      {/* Preferences */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">好み・条件</h3>
        <SettingsForm initialConditions={conditions} />
      </section>

      {/* Theme */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">テーマ</h3>
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)] flex items-center justify-between">
          <span className="text-sm">ダークモード</span>
          <ThemeSwitcher />
        </div>
      </section>

      {/* Logout */}
      <section>
        <LogoutButton />
      </section>
    </div>
  );
}
