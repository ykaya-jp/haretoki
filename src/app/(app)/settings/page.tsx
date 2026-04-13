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
      <h2 className="font-serif text-xl font-light tracking-wide">マイページ</h2>

      {/* Profile */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">あなたの情報</h3>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <p className="text-xs text-muted-foreground">メールアドレス</p>
          <p className="mt-1 font-medium">{user.email}</p>
        </div>
      </section>

      {/* Partner */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">パートナー</h3>
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
            inviteLink={`${process.env.APP_URL ?? "https://venuelens.vercel.app"}/accept-invite?project=${projectId}`}
            partnerStatus={partner ? "invited" : "not_invited"}
          />
        )}
      </section>

      {/* Preferences */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">おふたりの希望</h3>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <SettingsForm initialConditions={conditions} />
        </div>
      </section>

      {/* Theme */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">テーマ</h3>
        <div className="flex items-center justify-between rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <span className="text-sm">表示モード</span>
          <ThemeSwitcher />
        </div>
      </section>

      {/* Logout */}
      <section className="pt-4">
        <LogoutButton />
      </section>
    </div>
  );
}
