"use client";

import { Sparkles, MessageSquareWarning, Compass, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatrixReviewInsight } from "@/server/actions/matrix-review-insight";

interface MatrixReviewInsightCardProps {
  insight: MatrixReviewInsight | null;
}

/**
 * Cross-venue review insight card — sibling to `MatrixInsightCard`
 * (W18-7). Reads the same gold-subtle visual language so the two
 * cards stack visually as a "定量 + 定性" pair on the compare board:
 *
 *   - gold-subtle bg + 3px gold left border + Sparkles icon
 *     header (matches MatrixInsightCard exactly)
 *   - 3 tier sections (共通の懸念 / 強みの分かれ目 / 次に確認する
 *     こと) each with a small lucide icon eyebrow so the section
 *     intent reads at a glance
 *   - sections collapse cleanly when their list is empty — common
 *     for couples whose candidates genuinely have nothing in
 *     common, where divergence and decisionHint do all the work
 *
 * Renders nothing when `insight` is null (< 2 venues, or zero
 * reviews across the selection — same gating as the server action).
 */
export function MatrixReviewInsightCard({
  insight,
}: MatrixReviewInsightCardProps) {
  if (!insight) return null;

  const hasCommon = insight.commonConcerns.length > 0;
  const hasDivergence = insight.divergence.length > 0;
  const hint = insight.decisionHint?.trim() ?? "";
  const hasHint = hint.length > 0;

  // If literally nothing came back (shouldn't happen because the
  // server action returns null in that case, but the template
  // fallback can produce an empty card if every venue had no
  // strengths). Hide gracefully rather than render an empty shell.
  if (!hasCommon && !hasDivergence && !hasHint) return null;

  return (
    <div
      role="article"
      aria-label="口コミから見えるおふたりへの示唆"
      className={cn(
        "rounded-2xl border border-border/60 border-l-[3px] p-5",
        "border-l-[var(--gold-warm)] bg-[var(--gold-subtle)]",
      )}
    >
      <div className="mb-4 flex items-center gap-2">
        <Sparkles
          aria-hidden="true"
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.5}
        />
        <h3 className="text-eyebrow text-foreground">
          口コミから見えるおふたりへの示唆
        </h3>
      </div>

      <div className="space-y-5">
        {hasCommon && (
          <section aria-label="共通の懸念">
            <SectionHeader icon={MessageSquareWarning} label="共通の懸念" />
            <ul className="space-y-1.5">
              {insight.commonConcerns.map((line) => (
                <BulletLine key={line}>{line}</BulletLine>
              ))}
            </ul>
          </section>
        )}

        {hasDivergence && (
          <section aria-label="強みの分かれ目">
            <SectionHeader icon={Compass} label="強みの分かれ目" />
            <ul className="space-y-1.5">
              {insight.divergence.map((line) => (
                <BulletLine key={line}>{line}</BulletLine>
              ))}
            </ul>
          </section>
        )}

        {hasHint && (
          <section aria-label="次の見学で確認すること">
            <SectionHeader icon={ArrowRight} label="次に確認すること" />
            <p className="text-body text-foreground">{hint}</p>
          </section>
        )}
      </div>

      {insight.fallback && (
        <p
          aria-label="AI 集約は休止中"
          className="mt-4 text-[11px] leading-relaxed text-muted-foreground/80"
        >
          ※ いまは集約 AI が一時的にお休みしています。口コミから読み取れる範囲でお伝えしています。
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  label,
}: {
  icon: typeof Sparkles;
  label: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon
        aria-hidden="true"
        className="h-3.5 w-3.5 text-[var(--gold-warm)]"
        strokeWidth={1.6}
      />
      <span className="text-[11.5px] font-medium uppercase tracking-[0.16em] text-foreground/70">
        {label}
      </span>
    </div>
  );
}

function BulletLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-body text-foreground">
      <span
        aria-hidden="true"
        className="mt-[0.55em] inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--gold-warm)]/70"
      />
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}
