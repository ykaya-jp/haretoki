import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { LogoutButton } from "@/components/settings/logout-button";
import { DataManagement } from "@/components/settings/data-management";
import { ChevronLeft } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-10 pb-[env(safe-area-inset-bottom)]">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
          <Link
            href="/mypage"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Settings</span>
        </p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-h1 font-extralight tracking-[-0.01em]">
          整える
        </h2>
      </div>

      {/* Theme */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            Theme
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground">
            見た目
          </h3>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">テーマ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              端末に合わせる、またはお好みで
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </section>

      {/* Data management (GDPR) */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <p className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
            Data
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground">
            記録の管理
          </h3>
        </div>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]">
          <DataManagement userEmail={user.email ?? ""} />
        </div>
      </section>

      {/* Logout */}
      <section>
        <LogoutButton />
      </section>
    </div>
  );
}
