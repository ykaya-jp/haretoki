import { Heart, Sparkles } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import {
  formatWeddingDateLabel,
  weddingCountdownState,
} from "@/lib/wedding-countdown";
import { WeddingDateSetter } from "@/components/home/wedding-date-setter";

/**
 * Track C-2 wedding-day countdown card.
 *
 * Server Component — reads the active Decision once, derives state
 * via the pure helper, and branches:
 *
 *   future   → giant 「あと N 日」 + venue + 直近 todo 1 件
 *   today    → 「今日が晴れの日」 (no big number — the day itself
 *               is the message)
 *   past     → 「ありがとうございました」 + days-since (small)
 *   no-date  → 「晴れの日を残しませんか」 + WeddingDateSetter CTA
 *
 * Returns `null` when there's no Decision (pre-decision home should
 * show the unchanged hero NBA — caller decides where to mount this).
 *
 * The next-step todo for the future state is fetched here too so the
 * card is the single load anchor; matches `NextStepsCard`'s ordering
 * (orderIndex asc, completedAt null).
 */
export async function CountdownCard() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const decision = await prisma.decision.findUnique({
    where: { projectId },
    select: {
      weddingDate: true,
      venue: { select: { name: true } },
    },
  });
  if (!decision) return null;

  const state = weddingCountdownState({ weddingDate: decision.weddingDate });

  if (state.state === "no-date") {
    return (
      <CountdownShell>
        <p className="text-[10.5px] uppercase tracking-[0.3em] text-[var(--gold-warm)]">
          Countdown
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-[20px] font-light leading-snug tracking-[-0.005em]">
          晴れの日が決まったら、
          <br />
          おふたりに数えていきます
        </h2>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {decision.venue.name}での日が決まったら、ここに「あと N 日」と
          <br />
          直近の準備が並びます。
        </p>
        <WeddingDateSetter mode="cta" initialDate={null} />
      </CountdownShell>
    );
  }

  if (state.state === "today") {
    return (
      <CountdownShell tone="celebratory">
        <p className="text-[10.5px] uppercase tracking-[0.3em] text-[var(--gold-warm)]">
          Today
        </p>
        <h2 className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-[24px] font-light leading-tight tracking-[-0.01em]">
          <Sparkles
            className="h-5 w-5 text-[var(--gold-warm)]"
            aria-hidden="true"
          />
          今日が晴れの日
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {decision.venue.name}でおふたりの一日を、
          <br />
          ゆっくり愉しんできてください。
        </p>
      </CountdownShell>
    );
  }

  if (state.state === "past") {
    return (
      <CountdownShell tone="hushed">
        <p className="text-[10.5px] uppercase tracking-[0.3em] text-muted-foreground">
          Memory
        </p>
        <h2 className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-[20px] font-light leading-snug tracking-[-0.005em]">
          <Heart
            className="h-4 w-4 text-[var(--gold-warm)]"
            aria-hidden="true"
          />
          ありがとうございました
        </h2>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {decision.venue.name}での晴れの日から、
          <br />
          <span className="tabular-nums">{state.daysSince}</span>{" "}
          日が経ちました。
        </p>
      </CountdownShell>
    );
  }

  // state.state === "future"
  const topTodo = await prisma.decisionTodo.findFirst({
    where: { projectId, completedAt: null },
    orderBy: [{ orderIndex: "asc" }],
    select: { id: true, title: true, dueOffsetDays: true, priority: true },
  });
  const dateLabel = decision.weddingDate
    ? formatWeddingDateLabel(decision.weddingDate)
    : null;

  return (
    <CountdownShell>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10.5px] uppercase tracking-[0.3em] text-[var(--gold-warm)]">
          Countdown
        </p>
        {decision.weddingDate ? (
          <WeddingDateSetter
            mode="edit"
            initialDate={isoDateOnly(decision.weddingDate)}
          />
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="font-[family-name:var(--font-display)] text-[15px] font-light tracking-wide text-foreground">
          晴れの日まで
        </p>
        <p
          aria-label={`晴れの日まで あと ${state.daysUntil} 日`}
          className="flex items-baseline gap-2"
        >
          <span className="font-[family-name:var(--font-display)] text-[12px] font-light text-muted-foreground">
            あと
          </span>
          <span className="font-[family-name:var(--font-display)] text-[64px] font-extralight leading-none tracking-[-0.04em] tabular-nums text-foreground">
            {state.daysUntil}
          </span>
          <span className="font-[family-name:var(--font-display)] text-[16px] font-light text-foreground">
            日
          </span>
        </p>
        {dateLabel ? (
          <p className="text-[11.5px] tabular-nums text-muted-foreground">
            {decision.venue.name} ／ {dateLabel}
          </p>
        ) : null}
      </div>

      {topTodo ? (
        <Link
          href="/preparation"
          prefetch={true}
          className="-mx-1 flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/40 active:bg-muted"
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] border-border"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              Next
            </span>
            <span className="block truncate text-[14px] text-foreground">
              {topTodo.title}
            </span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
        </Link>
      ) : null}
    </CountdownShell>
  );
}

function CountdownShell({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "celebratory" | "hushed";
}) {
  return (
    <section
      aria-label="晴れの日カウントダウン"
      className={
        tone === "celebratory"
          ? "space-y-3 rounded-3xl border border-[color-mix(in_oklab,var(--gold-warm)_30%,transparent)] bg-gradient-to-br from-[color-mix(in_oklab,var(--gold-warm)_8%,var(--card))] via-card to-card p-6 shadow-[var(--shadow-card)]"
          : tone === "hushed"
            ? "space-y-3 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]"
            : "space-y-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]"
      }
    >
      {children}
    </section>
  );
}

/** YYYY-MM-DD in JST — stable across UTC boundaries. */
function isoDateOnly(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
