"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  requireUser,
  requireProjectMembership,
} from "@/server/auth";
import { captureServerEvent } from "@/lib/analytics/server";
import { captureError } from "@/lib/sentry";
import {
  DECISION_TODO_PRESETS,
  CUSTOM_TODO_LIMIT,
  type TodoPriority,
} from "@/lib/decision-todos/presets";

/**
 * F3 — 決定後の次アクション todo。
 *
 * 認可ポリシー: owner / partner 同格（setDecision / cancelDecision と同じ
 * 「ふたりで決めるもの」原則）。requireProjectMembership で十分。
 *
 * 冪等性: seedDecisionTodos は createMany({ skipDuplicates: true }) +
 * @@unique([projectId, templateKey]) で多端末競合を吸収。
 *
 * cache tag: `todos:${projectId}` を 1 本。mutation 後は tag + `/home` /
 * `/preparation` のパスを revalidate して partner 側にも反映。
 */

export type DecisionTodoView = {
  id: string;
  templateKey: string;
  source: "system" | "custom";
  title: string;
  description: string | null;
  priority: "high" | "normal" | "low";
  dueOffsetDays: number | null;
  orderIndex: number;
  completedAt: Date | null;
  completedBy: string | null;
};

function todosTag(projectId: string): string {
  return `todos:${projectId}`;
}

function toView(row: {
  id: string;
  templateKey: string;
  source: "system" | "custom";
  title: string;
  description: string | null;
  priority: "high" | "normal" | "low";
  dueOffsetDays: number | null;
  orderIndex: number;
  completedAt: Date | null;
  completedBy: string | null;
}): DecisionTodoView {
  return {
    id: row.id,
    templateKey: row.templateKey,
    source: row.source,
    title: row.title,
    description: row.description,
    priority: row.priority,
    dueOffsetDays: row.dueOffsetDays,
    orderIndex: row.orderIndex,
    completedAt: row.completedAt,
    completedBy: row.completedBy,
  };
}

/**
 * Seed the 15 system preset todos for the current project. Idempotent —
 * safe to call repeatedly. Returns the number actually inserted (0 when
 * already seeded).
 *
 * Called from makeDecision post-commit. Also usable as a lazy-seed
 * fallback from /preparation if the post-commit hook ever failed.
 */
export async function seedDecisionTodos(): Promise<{ seeded: number }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const data = DECISION_TODO_PRESETS.map((p) => ({
    projectId,
    templateKey: p.templateKey,
    source: "system" as const,
    title: p.title,
    description: p.description,
    priority: p.priority,
    dueOffsetDays: p.dueOffsetDays,
    orderIndex: p.orderIndex,
  }));

  try {
    const result = await prisma.decisionTodo.createMany({
      data,
      skipDuplicates: true,
    });
    if (result.count > 0) {
      revalidateTag(todosTag(projectId), { expire: 0 });
      revalidatePath("/home");
      revalidatePath("/preparation");
    }
    return { seeded: result.count };
  } catch (err) {
    captureError(err, { action: "seedDecisionTodos", projectId });
    throw err;
  }
}


/**
 * Home hero 下「次の一歩」 card 用: 未完了のうち orderIndex 昇順で最大 3 件。
 * 0 件のときは空配列。UI 側で card 自体を非表示にする。
 */
export async function getTopTodos(): Promise<DecisionTodoView[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const rows = await prisma.decisionTodo.findMany({
    where: { projectId, completedAt: null },
    orderBy: [{ orderIndex: "asc" }],
    take: 3,
  });
  return rows.map(toView);
}

/**
 * /preparation page 用: 全件 + 完了数 + 進捗率（0..1）。
 * `includeCompleted: false` にすると完了分を省いてフィードだけ返す。
 */
export async function getAllTodos(options?: {
  includeCompleted?: boolean;
}): Promise<{
  todos: DecisionTodoView[];
  completedCount: number;
  totalCount: number;
}> {
  const includeCompleted = options?.includeCompleted ?? true;
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const rows = await prisma.decisionTodo.findMany({
    where: {
      projectId,
      ...(includeCompleted ? {} : { completedAt: null }),
    },
    orderBy: [{ orderIndex: "asc" }],
  });

  // totalCount / completedCount は常に全件を母数とする（進捗率の意味論維持）。
  // includeCompleted: false のとき rows は未完了のみなので、完了数は別途 count する。
  const allCount = includeCompleted
    ? rows.length
    : await prisma.decisionTodo.count({ where: { projectId } });
  const completedCount = includeCompleted
    ? rows.filter((r) => r.completedAt !== null).length
    : await prisma.decisionTodo.count({
        where: { projectId, completedAt: { not: null } },
      });

  return {
    todos: rows.map(toView),
    completedCount,
    totalCount: allCount,
  };
}

const toggleInputSchema = z.object({
  todoId: z.string().uuid("todoId が不正です"),
});

/**
 * completedAt トグル（tap したタイミングで反転）。last-write-wins。
 * パートナー同時タップ時は後勝ちで良い — 「誰かが済ませた」事実だけが
 * 本質で、どちらが記録主かは completedBy で 1 人だけ残す（二人分持たない）。
 */
export async function toggleTodo(todoId: string): Promise<
  | { success: true; completed: boolean; allCompleted: boolean }
  | { error: Record<string, string[] | undefined> }
> {
  const validation = toggleInputSchema.safeParse({ todoId });
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.decisionTodo.findUnique({
    where: { id: todoId },
    select: { id: true, projectId: true, completedAt: true },
  });
  if (!existing || existing.projectId !== projectId) {
    return { error: { todoId: ["やることが見つかりませんでした"] } };
  }

  const nextCompleted = existing.completedAt === null;

  try {
    await prisma.decisionTodo.update({
      where: { id: todoId },
      data: {
        completedAt: nextCompleted ? new Date() : null,
        completedBy: nextCompleted ? user.id : null,
      },
    });
  } catch (err) {
    captureError(err, { action: "toggleTodo", projectId, todoId });
    throw err;
  }

  // allCompleted を返すことで UI がセレブレーションを出すかを決められる。
  const remaining = await prisma.decisionTodo.count({
    where: { projectId, completedAt: null },
  });
  const allCompleted = remaining === 0;

  revalidateTag(todosTag(projectId), { expire: 0 });
  revalidatePath("/home");
  revalidatePath("/preparation");

  await captureServerEvent(user.id, "decision_todo_toggled", {
    projectId,
    todoId,
    completed: nextCompleted,
    allCompleted,
  });

  return { success: true, completed: nextCompleted, allCompleted };
}

const priorityEnum = z.enum(["high", "normal", "low"]);
const addCustomSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "やることを入力してください")
    .max(80, "80 字以内で入力してください"),
  description: z.string().trim().max(200, "200 字以内で入力してください").optional(),
  priority: priorityEnum.optional(),
  dueOffsetDays: z.number().int().min(0).max(365).optional(),
});

/**
 * カスタム todo を追加（上限 10 件 / design §4.4）。
 * templateKey は衝突回避のため "custom:<uuid-ish>" 形式で自動採番。
 * orderIndex は現在の最大 + 1 で末尾に並べる（system 群の後ろ）。
 */
export async function addCustomTodo(input: {
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueOffsetDays?: number;
}): Promise<
  | { success: true; todo: DecisionTodoView }
  | { error: Record<string, string[] | undefined> }
> {
  const validation = addCustomSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const customCount = await prisma.decisionTodo.count({
    where: { projectId, source: "custom" },
  });
  if (customCount >= CUSTOM_TODO_LIMIT) {
    return {
      error: {
        title: [`追加できるのは ${CUSTOM_TODO_LIMIT} 件までです`],
      },
    };
  }

  const maxOrder = await prisma.decisionTodo.aggregate({
    where: { projectId },
    _max: { orderIndex: true },
  });
  const nextOrder = (maxOrder._max.orderIndex ?? -1) + 1;

  const templateKey = `custom:${crypto.randomUUID()}`;

  let row;
  try {
    row = await prisma.decisionTodo.create({
      data: {
        projectId,
        templateKey,
        source: "custom",
        title: validation.data.title,
        description: validation.data.description ?? null,
        priority: validation.data.priority ?? "normal",
        dueOffsetDays: validation.data.dueOffsetDays ?? null,
        orderIndex: nextOrder,
      },
    });
  } catch (err) {
    captureError(err, { action: "addCustomTodo", projectId });
    throw err;
  }

  revalidateTag(todosTag(projectId), { expire: 0 });
  revalidatePath("/home");
  revalidatePath("/preparation");

  await captureServerEvent(user.id, "decision_todo_added", {
    projectId,
    todoId: row.id,
    priority: row.priority,
  });

  return { success: true, todo: toView(row) };
}

/**
 * カスタム todo を削除。system todo は 404 相当（削除不可 — 網羅性シグナルを守る）。
 */
export async function deleteCustomTodo(todoId: string): Promise<
  | { success: true }
  | { error: Record<string, string[] | undefined> }
> {
  const validation = toggleInputSchema.safeParse({ todoId });
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.decisionTodo.findUnique({
    where: { id: todoId },
    select: { id: true, projectId: true, source: true },
  });
  if (!existing || existing.projectId !== projectId) {
    return { error: { todoId: ["やることが見つかりませんでした"] } };
  }
  if (existing.source !== "custom") {
    return { error: { todoId: ["標準のやることは削除できません"] } };
  }

  try {
    await prisma.decisionTodo.delete({ where: { id: todoId } });
  } catch (err) {
    captureError(err, { action: "deleteCustomTodo", projectId, todoId });
    throw err;
  }

  revalidateTag(todosTag(projectId), { expire: 0 });
  revalidatePath("/home");
  revalidatePath("/preparation");

  return { success: true };
}
