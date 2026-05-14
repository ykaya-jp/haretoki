import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";

/**
 * F migration onboarding page — v3 plan critic blocker #21.
 *
 * Why: PR #2 introduces the "parent dimension = mean of rated children"
 * model. Existing couples who already graded the parent dimensions
 * directly (via VenueScore source=user_rating) will see fewer / changed
 * surface UIs in the upcoming PRs. This page is the one-time welcome
 * that tells them their existing stars are preserved and explains what
 * changes — addressing the "突然挙動が変わって不安" problem head-on.
 *
 * Routing contract: linked from the home dashboard "新しい比較表が来ました"
 * banner (added in PR #4) and accessible standalone. No automatic
 * redirect — couples opt-in.
 *
 * Layout intent follows the v3 mock at
 *   tmp/mockups/v3/08-migration-mobile.html
 * but rendered with the existing Tailwind tokens (gold-warm / rose) so
 * it integrates with the rest of the app instead of feeling like an
 * external announcement.
 */

interface PreservedSummary {
  totalScores: number;
  perVenue: Array<{ venueName: string; scoreCount: number }>;
}

async function summariseExistingRatings(
  projectId: string,
): Promise<PreservedSummary> {
  // Count user_rating-sourced scores already on file for this project.
  // We're not migrating data yet (that's a follow-up in PR #5), just
  // promising the user nothing was lost.
  const scores = await prisma.venueScore.findMany({
    where: {
      source: "user_rating",
      venue: { projectId },
    },
    select: {
      venueId: true,
      venue: { select: { name: true } },
    },
  });

  const perVenueMap = new Map<string, { venueName: string; count: number }>();
  for (const row of scores) {
    const existing = perVenueMap.get(row.venueId);
    if (existing) {
      existing.count += 1;
    } else {
      perVenueMap.set(row.venueId, {
        venueName: row.venue.name,
        count: 1,
      });
    }
  }

  return {
    totalScores: scores.length,
    perVenue: Array.from(perVenueMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(({ venueName, count }) => ({ venueName, scoreCount: count })),
  };
}

export default async function WhatsNewPage() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  const summary = await summariseExistingRatings(projectId);

  // No existing scores? Send them straight to the comparison board —
  // there's nothing to "preserve" and the welcome copy would be jarring.
  if (summary.totalScores === 0) {
    redirect("/candidates");
  }

  return (
    <main className="mx-auto max-w-[420px] px-5 pb-24 pt-8 sm:max-w-[640px]">
      <header className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.32em] text-[var(--gold-warm)]">
          welcome back
        </span>
        <Link
          href="/candidates"
          className="text-xs italic text-muted-foreground underline-offset-4 hover:underline"
        >
          あとで読む
        </Link>
      </header>

      <div
        aria-hidden
        className="mt-8 flex h-40 items-end justify-center"
      >
        <div className="h-32 w-32 rounded-full bg-[radial-gradient(circle,_oklch(0.92_0.10_85)_0%,_var(--gold-warm)_70%)] shadow-[0_0_60px_-10px_oklch(0.78_0.12_75/0.5)]" />
      </div>

      <h1 className="mt-6 text-center font-[family-name:var(--font-display)] text-3xl font-light tracking-tight sm:text-4xl">
        あなたの星は、
        <span className="italic text-[var(--gold-warm)]">そのまま</span>です。
      </h1>

      <p className="mx-auto mt-3 max-w-[320px] text-center text-sm leading-relaxed text-muted-foreground sm:max-w-[420px]">
        比較表のしくみが、 少しだけ変わります。 これまであなたとパートナーが残した
        評価は、 ひとつも消えません。
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card/60 px-5 py-5 ring-1 ring-[var(--gold-warm)]/30">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--gold-warm)]">
          守られているもの
        </div>
        <p className="mt-1 font-[family-name:var(--font-display)] text-base italic text-foreground">
          これまで残した{" "}
          <span className="not-italic font-medium text-[var(--gold-warm)] tabular-nums">
            {summary.totalScores}
          </span>{" "}
          件の評価
        </p>
        {summary.perVenue.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {summary.perVenue.map((item) => (
              <li
                key={item.venueName}
                className="rounded-full border border-[var(--gold-warm)]/40 bg-background px-3 py-1 text-[11px] tabular-nums text-[var(--gold-warm)]"
              >
                {item.venueName} · {item.scoreCount}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-8 space-y-3 px-1 text-sm">
        <ChangeRow
          before="挙式会場に直接 ★ をつける"
          after="子の問いに答えると、 挙式会場の星は その平均に"
        />
        <ChangeRow
          before="用意された問いだけ"
          after="あなた独自の問いを 追加できる"
        />
        <ChangeRow before="自分の点数だけ" after="ふたりの点数が 並んで見える" />
      </section>

      <div className="mt-10 flex flex-col gap-2 px-2">
        <Link
          href="/candidates"
          className="block bg-foreground py-4 text-center font-[family-name:var(--font-display)] text-base italic text-background active:scale-[0.99]"
        >
          新しい比較表を ひらく
        </Link>
        <Link
          href="/coach"
          className="block py-3 text-center text-xs italic text-muted-foreground"
        >
          AI コーチに 質問する
        </Link>
      </div>

      <p className="mt-10 px-4 text-center text-[11px] leading-relaxed text-muted-foreground/80">
        既存の評価は、 これからの比較表でも 引き続き同じ場所に表示されます。
        変更があれば いつでも編集できます。
      </p>
    </main>
  );
}

function ChangeRow({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_24px_1fr] items-center gap-2 border-t border-dotted border-border py-3 first:border-t-0">
      <div className="text-right text-[12px] italic text-muted-foreground">
        {before}
      </div>
      <div className="text-center text-xs text-[var(--gold-warm)]" aria-hidden>
        →
      </div>
      <div className="text-[12.5px] italic">
        <span className="not-italic font-medium text-foreground">{after}</span>
      </div>
    </div>
  );
}
