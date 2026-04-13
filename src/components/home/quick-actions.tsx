import Link from "next/link";
import { Search, Receipt, ClipboardCheck, Heart } from "lucide-react";

const ACTIONS = [
  { href: "/explore", icon: Search, label: "式場検索" },
  { href: "/candidates", icon: Receipt, label: "見積比較" },
  { href: "/explore", icon: ClipboardCheck, label: "チェック" },
  { href: "/candidates", icon: Heart, label: "候補一覧" },
] as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
          >
            <Icon className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium">{action.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
