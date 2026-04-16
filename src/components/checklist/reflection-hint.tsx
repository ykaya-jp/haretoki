import Link from "next/link";
import { ArrowRight, ClipboardCheck, LayoutGrid } from "lucide-react";

interface ReflectionHintProps {
  activeCount: number;
}

/**
 * Thin "反映先" strip shown above the category list once ≥1 item is active.
 * Tells couples where the items they select will actually appear — closes
 * F-20 ("反映先不明") by making the downstream destinations concrete.
 */
export function ReflectionHint({ activeCount }: ReflectionHintProps) {
  return (
    <section
      aria-label="選んだ項目の反映先"
      className="rounded-2xl border border-border/70 bg-card/60 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          選んだ {activeCount} 項目は、ここに反映されます
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href="/candidates?tab=checklist"
          prefetch={true}
          className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3.5 py-3 transition hover:bg-background/80 active:scale-[0.99]"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--gold-subtle)" }}
          >
            <LayoutGrid
              className="h-4 w-4 text-[var(--gold-warm)]"
              strokeWidth={1.5}
            />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-foreground">
              チェック差分で比較
            </span>
            <span className="block truncate text-[11.5px] text-muted-foreground">
              選んだ {activeCount} 項目を式場ごとに並べます
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5"
            strokeWidth={1.5}
          />
        </Link>

        <Link
          href="/candidates"
          prefetch={true}
          className="group flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-3.5 py-3 transition hover:bg-background/80 active:scale-[0.99]"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--gold-subtle)" }}
          >
            <ClipboardCheck
              className="h-4 w-4 text-[var(--gold-warm)]"
              strokeWidth={1.5}
            />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium text-foreground">
              式場別の見学メモ
            </span>
            <span className="block truncate text-[11.5px] text-muted-foreground">
              各式場ページでひとつずつ記録
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5"
            strokeWidth={1.5}
          />
        </Link>
      </div>
    </section>
  );
}
