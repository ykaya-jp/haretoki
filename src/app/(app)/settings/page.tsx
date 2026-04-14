import Link from "next/link";
import { requireUser } from "@/server/auth";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { LogoutButton } from "@/components/settings/logout-button";
import { DataManagement } from "@/components/settings/data-management";
import { ChevronLeft } from "lucide-react";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-8 pb-[env(safe-area-inset-bottom)]">
      <Link
        href="/mypage"
        prefetch
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-opacity duration-200 hover:opacity-70"
      >
        <ChevronLeft className="h-4 w-4" />
        マイページ
      </Link>

      <h2 className="font-serif text-2xl font-light tracking-wide">設定</h2>

      {/* Theme */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          見た目
        </h3>
        <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">テーマ</p>
            <p className="mt-1 text-xs text-muted-foreground">
              端末の設定に合わせる、またはお好みで
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </section>

      {/* Data management (GDPR) */}
      <section className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          データ管理
        </h3>
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
