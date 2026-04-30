import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F3 — decision-todos Server Action 契約テスト。
 *
 * カバー範囲:
 *   1. seedDecisionTodos: 15 件 createMany、冪等性（skipDuplicates）
 *   2. getTopTodos: 未完了 orderIndex 昇順で 3 件
 *   3. toggleTodo: last-write-wins（race で 2 回目呼び出しが上書きできる）
 *   4. addCustomTodo: 上限 10 件を超えると error
 *   5. deleteCustomTodo: system 削除不可（404 相当）
 */

const decisionTodoCreateMany = vi.fn();
const decisionTodoFindMany = vi.fn();
const decisionTodoFindUnique = vi.fn();
const decisionTodoUpdate = vi.fn();
const decisionTodoCount = vi.fn();
const decisionTodoUpdateMany = vi.fn();
const decisionTodoCreate = vi.fn();
const decisionTodoDelete = vi.fn();
const decisionTodoAggregate = vi.fn();

vi.mock("@/server/db", () => ({
  prisma: {
    decisionTodo: {
      createMany: (...args: unknown[]) => decisionTodoCreateMany(...args),
      findMany: (...args: unknown[]) => decisionTodoFindMany(...args),
      findUnique: (...args: unknown[]) => decisionTodoFindUnique(...args),
      update: (...args: unknown[]) => decisionTodoUpdate(...args),
      updateMany: (...args: unknown[]) => decisionTodoUpdateMany(...args),
      count: (...args: unknown[]) => decisionTodoCount(...args),
      create: (...args: unknown[]) => decisionTodoCreate(...args),
      delete: (...args: unknown[]) => decisionTodoDelete(...args),
      aggregate: (...args: unknown[]) => decisionTodoAggregate(...args),
    },
  },
}));

vi.mock("@/server/auth", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  requireProjectMembership: vi.fn(async () => ({
    projectId: "proj-1",
    role: "owner",
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/analytics/server", () => ({
  captureServerEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
  captureMessage: vi.fn(),
}));

beforeEach(() => {
  decisionTodoCreateMany.mockReset();
  decisionTodoFindMany.mockReset();
  decisionTodoFindUnique.mockReset();
  decisionTodoUpdate.mockReset();
  decisionTodoUpdateMany.mockReset();
  decisionTodoCount.mockReset();
  decisionTodoCreate.mockReset();
  decisionTodoDelete.mockReset();
  decisionTodoAggregate.mockReset();
});

describe("seedDecisionTodos", () => {
  it("inserts 15 system presets with skipDuplicates (idempotent)", async () => {
    decisionTodoCreateMany.mockResolvedValue({ count: 15 });

    const { seedDecisionTodos } = await import(
      "@/server/actions/decision-todos"
    );
    const res = await seedDecisionTodos();

    expect(res).toEqual({ seeded: 15 });
    expect(decisionTodoCreateMany).toHaveBeenCalledOnce();
    const arg = decisionTodoCreateMany.mock.calls[0][0] as {
      data: unknown[];
      skipDuplicates: boolean;
    };
    expect(arg.skipDuplicates).toBe(true);
    expect(arg.data).toHaveLength(15);
    // Every row carries projectId + templateKey + source=system
    for (const row of arg.data as Array<{
      projectId: string;
      templateKey: string;
      source: string;
    }>) {
      expect(row.projectId).toBe("proj-1");
      expect(row.source).toBe("system");
      expect(typeof row.templateKey).toBe("string");
    }
  });

  it("second invocation is a no-op when all 15 rows already exist", async () => {
    decisionTodoCreateMany.mockResolvedValue({ count: 0 });

    const { seedDecisionTodos } = await import(
      "@/server/actions/decision-todos"
    );
    const res = await seedDecisionTodos();

    expect(res).toEqual({ seeded: 0 });
    // still invoked createMany once — no-op is enforced at DB layer
    expect(decisionTodoCreateMany).toHaveBeenCalledOnce();
  });
});

describe("getTopTodos", () => {
  it("returns up to 3 incomplete todos sorted by orderIndex asc", async () => {
    const rows = [
      {
        id: "t1",
        templateKey: "contract_review",
        source: "system",
        title: "契約書を読み合わせる",
        description: null,
        priority: "high",
        dueOffsetDays: 7,
        orderIndex: 0,
        completedAt: null,
        completedBy: null,
      },
    ];
    decisionTodoFindMany.mockResolvedValue(rows);

    const { getTopTodos } = await import("@/server/actions/decision-todos");
    const result = await getTopTodos();

    expect(result).toHaveLength(1);
    expect(decisionTodoFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "proj-1", completedAt: null },
        take: 3,
        orderBy: [{ orderIndex: "asc" }],
      }),
    );
  });
});

describe("toggleTodo — last-write-wins race", () => {
  it("marks completed when currently pending", async () => {
    decisionTodoFindUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj-1",
      completedAt: null,
    });
    decisionTodoUpdate.mockResolvedValue({});
    decisionTodoCount.mockResolvedValue(14); // 14 still pending after toggle

    const { toggleTodo } = await import("@/server/actions/decision-todos");
    const res = await toggleTodo("11111111-1111-4111-8111-111111111111");

    expect("success" in res && res.success).toBe(true);
    if ("success" in res && res.success) {
      expect(res.completed).toBe(true);
      expect(res.allCompleted).toBe(false);
    }
    expect(decisionTodoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedBy: "user-1",
        }),
      }),
    );
    // completedAt should be a Date instance
    const updateArg = decisionTodoUpdate.mock.calls[0][0] as {
      data: { completedAt: Date | null };
    };
    expect(updateArg.data.completedAt).toBeInstanceOf(Date);
  });

  it("unmarks when currently completed (toggle back)", async () => {
    decisionTodoFindUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj-1",
      completedAt: new Date(),
    });
    decisionTodoUpdate.mockResolvedValue({});
    decisionTodoCount.mockResolvedValue(15);

    const { toggleTodo } = await import("@/server/actions/decision-todos");
    const res = await toggleTodo("22222222-2222-4222-a222-222222222222");

    if ("success" in res && res.success) {
      expect(res.completed).toBe(false);
    }
    expect(decisionTodoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { completedAt: null, completedBy: null },
      }),
    );
  });

  it("simulates race: two sequential toggles → the later call wins (last-write-wins)", async () => {
    // Simulate 2 partners tapping the same todo near-simultaneously.
    // In our model, findUnique → update is not in a transaction, so the
    // 2nd request reads whatever the 1st wrote. We assert the final state
    // reflects the 2nd call.
    const { toggleTodo } = await import("@/server/actions/decision-todos");

    // Call 1: task is pending, user flips to completed.
    decisionTodoFindUnique.mockResolvedValueOnce({
      id: "t1",
      projectId: "proj-1",
      completedAt: null,
    });
    decisionTodoUpdate.mockResolvedValueOnce({});
    decisionTodoCount.mockResolvedValueOnce(14);
    await toggleTodo("33333333-3333-4333-b333-333333333333");

    // Call 2: task is now completed, partner flips it back to pending.
    decisionTodoFindUnique.mockResolvedValueOnce({
      id: "t1",
      projectId: "proj-1",
      completedAt: new Date(),
    });
    decisionTodoUpdate.mockResolvedValueOnce({});
    decisionTodoCount.mockResolvedValueOnce(15);
    const res2 = await toggleTodo("33333333-3333-4333-b333-333333333333");

    // Final write overwrote the first: last-write-wins.
    if ("success" in res2 && res2.success) {
      expect(res2.completed).toBe(false);
    }
    const secondCallArgs = decisionTodoUpdate.mock.calls[1][0] as {
      data: { completedAt: Date | null; completedBy: string | null };
    };
    expect(secondCallArgs.data.completedAt).toBeNull();
    expect(secondCallArgs.data.completedBy).toBeNull();
  });

  it("rejects toggle for a todo outside the user's project (cross-tenant guard)", async () => {
    decisionTodoFindUnique.mockResolvedValue({
      id: "t1",
      projectId: "other-project",
      completedAt: null,
    });

    const { toggleTodo } = await import("@/server/actions/decision-todos");
    const res = await toggleTodo("44444444-4444-4444-8444-444444444444");

    expect("error" in res).toBe(true);
    expect(decisionTodoUpdate).not.toHaveBeenCalled();
  });
});

describe("addCustomTodo — 10 件上限", () => {
  beforeEach(() => {
    decisionTodoAggregate.mockResolvedValue({ _max: { orderIndex: 14 } });
  });

  it("rejects when custom todos already at limit (10)", async () => {
    decisionTodoCount.mockResolvedValue(10);

    const { addCustomTodo } = await import("@/server/actions/decision-todos");
    const res = await addCustomTodo({ title: "お礼状の宛名確認" });

    expect("error" in res).toBe(true);
    if ("error" in res) {
      expect(res.error.title?.[0]).toMatch(/10/);
    }
    expect(decisionTodoCreate).not.toHaveBeenCalled();
  });

  it("creates a custom row with orderIndex = max+1 when under the limit", async () => {
    decisionTodoCount.mockResolvedValue(3);
    decisionTodoCreate.mockResolvedValue({
      id: "new-custom-1",
      templateKey: "custom:x",
      source: "custom",
      title: "お礼状の宛名確認",
      description: null,
      priority: "normal",
      dueOffsetDays: null,
      orderIndex: 15,
      completedAt: null,
      completedBy: null,
    });

    const { addCustomTodo } = await import("@/server/actions/decision-todos");
    const res = await addCustomTodo({ title: "お礼状の宛名確認" });

    expect("success" in res && res.success).toBe(true);
    expect(decisionTodoCreate).toHaveBeenCalledOnce();
    const createArg = decisionTodoCreate.mock.calls[0][0] as {
      data: {
        source: string;
        orderIndex: number;
        templateKey: string;
      };
    };
    expect(createArg.data.source).toBe("custom");
    expect(createArg.data.orderIndex).toBe(15);
    expect(createArg.data.templateKey.startsWith("custom:")).toBe(true);
  });
});

describe("deleteCustomTodo — system 不可", () => {
  it("refuses to delete a system todo (404 相当)", async () => {
    decisionTodoFindUnique.mockResolvedValue({
      id: "t1",
      projectId: "proj-1",
      source: "system",
    });

    const { deleteCustomTodo } = await import(
      "@/server/actions/decision-todos"
    );
    const res = await deleteCustomTodo(
      "55555555-5555-4555-9555-555555555555",
    );

    expect("error" in res).toBe(true);
    expect(decisionTodoDelete).not.toHaveBeenCalled();
  });

  it("deletes a custom todo", async () => {
    decisionTodoFindUnique.mockResolvedValue({
      id: "t2",
      projectId: "proj-1",
      source: "custom",
    });
    decisionTodoDelete.mockResolvedValue({});

    const { deleteCustomTodo } = await import(
      "@/server/actions/decision-todos"
    );
    const res = await deleteCustomTodo(
      "66666666-6666-4666-8666-666666666666",
    );

    expect("success" in res && res.success).toBe(true);
    expect(decisionTodoDelete).toHaveBeenCalledOnce();
  });
});

describe("security: internal helpers must not be exported from decision-todos Server Action", () => {
  it("_seedDecisionTodosForProject is not exported (moved to lib/decision-todos/seed.ts)", async () => {
    const actions = await import("@/server/actions/decision-todos");
    expect(
      (actions as Record<string, unknown>)["_seedDecisionTodosForProject"],
    ).toBeUndefined();
  });

  it("_resetDecisionTodosForProject is not exported (moved to lib/decision-todos/seed.ts)", async () => {
    const actions = await import("@/server/actions/decision-todos");
    expect(
      (actions as Record<string, unknown>)["_resetDecisionTodosForProject"],
    ).toBeUndefined();
  });
});
