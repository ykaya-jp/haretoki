import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/server/db";
import { DECISION_TODO_PRESETS } from "@/lib/decision-todos/presets";

/** Shared tag helper — must stay in sync with the same function in decision-todos.ts. */
function todosTag(projectId: string): string {
  return `todos:${projectId}`;
}

/**
 * Seed the 15 system preset todos for the given project. Idempotent —
 * safe to call repeatedly (skipDuplicates). Returns the number actually
 * inserted (0 when already seeded).
 *
 * NOTE: No "use server" here — this is a plain module, NOT a Server Action.
 * Call this only from inside an already-authenticated Server Action.
 */
export async function seedSystemTodos(
  projectId: string,
): Promise<{ seeded: number }> {
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
}

/**
 * Reset completion state for all existing todos in a project.
 * Called from makeDecision when the decided venue changes so that
 * completions from venue A don't silently carry over to venue B.
 *
 * NOTE: No "use server" here — plain module, call only from authenticated
 * Server Actions.
 */
export async function resetSystemTodosCompletion(
  projectId: string,
): Promise<{ reset: number }> {
  const result = await prisma.decisionTodo.updateMany({
    where: { projectId, completedAt: { not: null } },
    data: { completedAt: null, completedBy: null },
  });
  if (result.count > 0) {
    revalidateTag(todosTag(projectId), { expire: 0 });
    revalidatePath("/home");
    revalidatePath("/preparation");
  }
  return { reset: result.count };
}
