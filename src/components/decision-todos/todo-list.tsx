"use client";

import { useMemo, useState } from "react";
import { showToast } from "@/lib/toast";
import { TodoRow } from "./todo-row";
import { AddCustomTodoForm } from "./add-custom-todo-form";
import type { DecisionTodoView } from "@/server/actions/decision-todos";

interface TodoListProps {
  todos: DecisionTodoView[];
  completedCount: number;
  totalCount: number;
  customCount: number;
  customLimit: number;
}

/**
 * /preparation のクライアントコンテナ。
 * - 「今週やること」(dueOffsetDays <= 7 かつ 未完了) を上に固める
 * - system todo を「このあと」に
 * - custom todo を「自分たちのやること」に分離
 * - aria-live アナウンサーで完了 / 残件数を screen reader に通知
 */
export function TodoList({
  todos,
  completedCount,
  totalCount,
  customCount,
  customLimit,
}: TodoListProps) {
  const [announcement, setAnnouncement] = useState("");
  // 1 件完了時の copy 減衰（design §4.3）: 初回は優しく、2 回目以降は淡々と。
  const [hasCelebratedFirst, setHasCelebratedFirst] = useState(
    completedCount > 0,
  );

  const { thisWeek, upcoming, custom } = useMemo(() => {
    const tw: DecisionTodoView[] = [];
    const up: DecisionTodoView[] = [];
    const cu: DecisionTodoView[] = [];

    for (const t of todos) {
      if (t.source === "custom") {
        cu.push(t);
        continue;
      }
      if (
        t.completedAt === null &&
        t.dueOffsetDays !== null &&
        t.dueOffsetDays <= 7
      ) {
        tw.push(t);
      } else {
        up.push(t);
      }
    }
    return { thisWeek: tw, upcoming: up, custom: cu };
  }, [todos]);

  const remaining = totalCount - completedCount;
  const handleToggled = ({
    completed,
    allCompleted,
  }: {
    completed: boolean;
    allCompleted: boolean;
  }) => {
    if (completed) {
      const nextRemaining = Math.max(remaining - 1, 0);
      setAnnouncement(`1 件完了。残り ${nextRemaining} 件`);
      if (allCompleted) {
        showToast("success", `${totalCount} つ、すべて終わりました。おつかれさまでした`);
      } else if (!hasCelebratedFirst) {
        showToast("success", "はじめの一歩、お疲れさまでした");
        setHasCelebratedFirst(true);
      } else {
        showToast("success", "ひとつ済みました");
      }
    } else {
      setAnnouncement(`1 件 戻しました。残り ${remaining + 1} 件`);
      showToast("info", "戻しました");
    }
  };

  return (
    <div className="space-y-10">
      {/* aria-live: assertive は避け polite で十分。完了アナウンスは割り込み不要 */}
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {announcement}
      </p>

      {thisWeek.length > 0 && (
        <section
          aria-labelledby="this-week-heading"
          className="relative overflow-hidden rounded-2xl border-l-2 border-[var(--gold-warm)] p-4 pl-5"
          style={{
            background:
              "color-mix(in oklab, var(--gold-warm) 6%, transparent)",
          }}
        >
          <h2
            id="this-week-heading"
            className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--gold-warm)]"
          >
            今週やること · {thisWeek.length}
          </h2>
          <ul className="mt-3 space-y-2">
            {thisWeek.map((t) => (
              <TodoRow
                key={t.id}
                todo={t}
                onToggled={handleToggled}
              />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2
            id="upcoming-heading"
            className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            このあと
          </h2>
          <ul className="space-y-2">
            {upcoming.map((t) => (
              <TodoRow key={t.id} todo={t} onToggled={handleToggled} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="custom-heading" className="space-y-3">
        <h2
          id="custom-heading"
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          自分たちのやること
          {customCount > 0 && (
            <span className="ml-1.5 tabular-nums">· {customCount}</span>
          )}
        </h2>
        {custom.length > 0 && (
          <ul className="space-y-2">
            {custom.map((t) => (
              <TodoRow key={t.id} todo={t} onToggled={handleToggled} />
            ))}
          </ul>
        )}
        <AddCustomTodoForm
          disabled={customCount >= customLimit}
          remaining={customLimit - customCount}
        />
      </section>
    </div>
  );
}
