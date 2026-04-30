import Link from "next/link";
import { getTopTodos } from "@/server/actions/decision-todos";

/**
 * Home hero 下の「次の一歩」 card。
 * - 未完了 top 3 件のみ表示
 * - 0 件（未決定 or 全件完了）なら card 自体を返さない
 * - タップ／リンクで /preparation へ誘導
 *
 * Server Component として描画し、/preparation へ prefetch する。
 */
export async function NextStepsCard() {
  const topTodos = await getTopTodos();
  if (topTodos.length === 0) return null;

  return (
    <section aria-labelledby="next-steps-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
            NEXT STEPS
          </p>
          <h2
            id="next-steps-heading"
            className="mt-0.5 font-[family-name:var(--font-display)] text-[18px] font-light tracking-[0.01em]"
          >
            次の一歩
          </h2>
        </div>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {topTodos.map((t) => (
          <li key={t.id}>
            <Link
              href="/preparation"
              prefetch={true}
              className="flex min-h-[56px] items-center gap-3 px-4 py-3 transition-colors active:bg-muted"
            >
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--border)]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-foreground">{t.title}</p>
                {(t.dueOffsetDays !== null || t.priority === "high") && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {t.dueOffsetDays !== null && (
                      <span>あと {t.dueOffsetDays} 日めやす</span>
                    )}
                    {t.dueOffsetDays !== null && t.priority === "high" && (
                      <span aria-hidden className="text-muted-foreground/50">
                        ·
                      </span>
                    )}
                    {t.priority === "high" && (
                      <span className="text-[var(--gold-warm)]">たいせつ</span>
                    )}
                  </p>
                )}
              </div>
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="text-center">
        <Link
          href="/preparation"
          prefetch={true}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-full px-4 text-[12.5px] text-muted-foreground underline-offset-4 hover:underline"
        >
          全部を見る
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
