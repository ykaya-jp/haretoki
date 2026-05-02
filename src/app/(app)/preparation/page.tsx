import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Sun } from "lucide-react";
import {
  getAllTodos,
  seedDecisionTodos,
} from "@/server/actions/decision-todos";
import { getDecision } from "@/server/actions/decisions";
import { TodoList } from "@/components/decision-todos/todo-list";
import { DecisionProgressRing } from "@/components/decision-todos/progress-ring";
import { CUSTOM_TODO_LIMIT } from "@/lib/decision-todos/presets";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "晴れの日へ、次の一歩",
  description:
    "式場を決めたあとの準備リスト。契約・支払い・招待状まで、ふたりでひとつずつ。",
};

export default async function PreparationPage() {
  // 決定前に /preparation が叩かれたら empty state を見せる（/explore への導線つき）。
  const decision = await getDecision();

  if (!decision) {
    // D1-1 (Phase 3 商用化準備): 「決めるのは、まだ先で大丈夫」 — 決定前に
    // /preparation に着いた couple が「なにもない真っ白画面」 ではなく、
    // 「ここはまだ先のための場所、いまは比較から」と分かる empty state。
    // CTA は /compare (比較ボード) — 決定の前提は「比べた結果」なので、
    // 候補追加段階の /explore よりも次の一歩として自然。
    // ブランドメタファー: Sun icon → 「晴れの日 (決めた日) はあとからやってくる」
    return (
      <div className="space-y-8 pb-24">
        <header className="space-y-1">
          <Link
            href="/home"
            prefetch={true}
            aria-label="ホームに戻る"
            className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pl-2 pr-3 text-[13px] text-muted-foreground transition-colors active:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
            ホーム
          </Link>
        </header>
        <EmptyState
          icon={Sun}
          title="決めるのは、まだ先で大丈夫"
          description="おふたりが「ここで決めた」と思える瞬間まで、ここで待っています。準備のリストは、決まったその日から整います。"
          action={{ label: "候補を比べてみる", href: "/compare" }}
        />
      </div>
    );
  }

  // Lazy seed: 決定はあるが何らかの理由で post-commit seed が失敗している
  // ケースの救済。冪等（skipDuplicates）なので 2 回目以降の訪問は no-op。
  let { todos, completedCount, totalCount } = await getAllTodos();
  if (totalCount === 0) {
    await seedDecisionTodos();
    ({ todos, completedCount, totalCount } = await getAllTodos());
  }

  const customCount = todos.filter((t) => t.source === "custom").length;

  return (
    <div className="space-y-10 pb-24">
      <header className="space-y-1">
        <Link
          href="/home"
          prefetch={true}
          aria-label="ホームに戻る"
          className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full pl-2 pr-3 text-[13px] text-muted-foreground transition-colors active:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
          ホーム
        </Link>
      </header>

      <section className="space-y-3">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
          TOWARDS THE DAY
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[24px] font-light leading-[1.2] tracking-[0.01em]">
          晴れの日へ、次の一歩
        </h1>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          ふたりで、ゆっくりで大丈夫です
        </p>
      </section>

      <div className="flex justify-center py-2">
        <DecisionProgressRing
          completed={completedCount}
          total={totalCount}
        />
      </div>

      <TodoList
        todos={todos}
        completedCount={completedCount}
        totalCount={totalCount}
        customCount={customCount}
        customLimit={CUSTOM_TODO_LIMIT}
      />

      {completedCount === totalCount && totalCount > 0 && (
        <section
          aria-live="polite"
          className="rounded-3xl border-l-2 border-[var(--gold-warm)] p-5"
          style={{
            background:
              "color-mix(in oklab, var(--gold-warm) 8%, transparent)",
          }}
        >
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
            大枠は整いました
          </p>
          <p className="mt-2 font-[family-name:var(--font-display)] text-[18px] font-light leading-[1.35]">
            おふたりの朝が近づいています
          </p>
        </section>
      )}
    </div>
  );
}
