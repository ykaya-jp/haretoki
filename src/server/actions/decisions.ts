"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  requireUser,
  requireProjectMembership,
  requireVenueAccess,
} from "@/server/auth";
import { captureServerEvent } from "@/lib/analytics/server";
import { captureError } from "@/lib/sentry";
import {
  seedSystemTodos,
  resetSystemTodosCompletion,
} from "@/lib/decision-todos/seed";
import { parseWeddingDateInput } from "@/lib/wedding-countdown";
import {
  publishRealtimeEvent,
  resolveActor,
} from "@/lib/realtime/publish";

const decisionSchema = z.object({
  selectedVenueId: z.string().uuid("式場を選択してください"),
  rationale: z.string().optional(),
});

export async function makeDecision(input: z.input<typeof decisionSchema>) {
  const validation = decisionSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  // Both owner and partner can decide: 結婚式場選びはふたりで決めるものが
  // 大前提なので、owner-only だと partner が決定ボタンを押せず体験が壊れる。
  // Audit L0: makeDecision/cancelDecision は project membership のみで認可。
  // 片方が誤タップしたら互いにキャンセルできるので最悪ケースも recoverable。
  const { projectId } = await requireProjectMembership(user.id);
  await requireVenueAccess(user.id, validation.data.selectedVenueId);

  // F3: 決定前の状態を拾って、venue が変わったかを判定する材料にする。
  //   - priorDecision: upsert 前の Decision 行（re-decision で上書きするケース）
  //   - lastCancelled: 直前に cancelDecision で控えた venueId（cancel→make の連続ケース）
  // どちらかの venueId が今回の selectedVenueId と異なれば、以前の todo 完了状態は
  // 別 venue のものなので reset する（design §4.4 edge cases）。
  const [priorDecision, projectRow] = await Promise.all([
    prisma.decision.findUnique({
      where: { projectId },
      select: { selectedVenueId: true },
    }),
    prisma.project.findUnique({
      where: { id: projectId },
      select: { lastCancelledVenueId: true },
    }),
  ]);
  const priorVenueId =
    priorDecision?.selectedVenueId ?? projectRow?.lastCancelledVenueId ?? null;
  const venueChanged =
    priorVenueId !== null && priorVenueId !== validation.data.selectedVenueId;

  let decision;
  try {
    decision = await prisma.$transaction(async (tx) => {
      await tx.venue.update({
        where: { id: validation.data.selectedVenueId, projectId },
        data: { status: "selected" },
      });

      // Clear the cancellation marker now that a new decision is being made.
      // This prevents stale state from triggering future resets.
      await tx.project.update({
        where: { id: projectId },
        data: { lastCancelledVenueId: null },
      });

      return tx.decision.upsert({
        where: { projectId },
        update: {
          selectedVenueId: validation.data.selectedVenueId,
          rationale: validation.data.rationale ?? null,
        },
        create: {
          projectId,
          selectedVenueId: validation.data.selectedVenueId,
          rationale: validation.data.rationale ?? null,
        },
      });
    });
  } catch (err) {
    // Report-and-rethrow: the route's error boundary still shows the ceremony
    // failure screen, but Sentry gets the structured context (no PII here —
    // just venue + project IDs).
    captureError(err, {
      action: "makeDecision",
      projectId,
      selectedVenueId: validation.data.selectedVenueId,
    });
    throw err;
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/candidates");
  revalidatePath("/home");
  revalidatePath("/explore");

  // F3: Post-commit side effects — seed + (conditional) reset. これらは
  // transaction 外で走らせる。理由は design §2.4: seed 失敗で決定そのものを
  // ロールバックするべきでないため。失敗は Sentry に捕えて、lazy seed
  // （/preparation 初回訪問）で救済する。
  if (venueChanged) {
    try {
      await resetSystemTodosCompletion(projectId);
    } catch (err) {
      captureError(err, {
        action: "makeDecision.resetTodos",
        projectId,
        priorVenueId,
        selectedVenueId: validation.data.selectedVenueId,
      });
    }
  }
  try {
    await seedSystemTodos(projectId);
  } catch (err) {
    captureError(err, {
      action: "makeDecision.seedTodos",
      projectId,
      selectedVenueId: validation.data.selectedVenueId,
    });
  }

  await captureServerEvent(user.id, "decision_made", {
    projectId,
    venueId: validation.data.selectedVenueId,
    hasRationale: Boolean(validation.data.rationale),
    venueChanged,
  });

  // Phase 3 L3 wave 1 — broadcast a decision_made so the partner's
  // open client paints a "{name}さんが式場を決定しました" toast and
  // refreshes their view (most likely they were on /candidates or
  // /home at the time). Best-effort.
  const actor = await resolveActor(user.id);
  await publishRealtimeEvent(projectId, {
    kind: "decision_made",
    actor,
    venueId: validation.data.selectedVenueId,
  });

  return { decision };
}

export async function getDecision() {
  const user = await requireUser();
  const membership = await requireProjectMembership(user.id);

  return prisma.decision.findUnique({
    where: { projectId: membership.projectId },
    include: { venue: true },
  });
}

/**
 * Cancel an existing decision — deletes the Decision row and reverts the
 * venue's status from `selected` back to `shortlisted` so it still appears
 * in the candidate list. Only the project owner can cancel.
 */
export async function cancelDecision() {
  const user = await requireUser();
  // Same "ふたりで決める" rule as makeDecision — either member can cancel.
  const { projectId } = await requireProjectMembership(user.id);

  const existing = await prisma.decision.findUnique({
    where: { projectId },
    select: { selectedVenueId: true },
  });
  if (!existing) return { cancelled: false as const };

  try {
    await prisma.$transaction([
      prisma.decision.delete({ where: { projectId } }),
      prisma.venue.update({
        where: { id: existing.selectedVenueId },
        data: { status: "shortlisted" },
      }),
      // F3: 次の makeDecision 時に「同一 venue か別 venue か」を判定する材料。
      // Decision 行は上で delete しているため、venueId をここに控えないと
      // 比較できなくなる（cancel→make の連続ケースで再決定先の venue が
      // 変わったかの判別が不能になる）。
      prisma.project.update({
        where: { id: projectId },
        data: { lastCancelledVenueId: existing.selectedVenueId },
      }),
    ]);
  } catch (err) {
    captureError(err, {
      action: "cancelDecision",
      projectId,
      venueId: existing.selectedVenueId,
    });
    throw err;
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/candidates");
  revalidatePath("/home");
  revalidatePath("/explore");

  await captureServerEvent(user.id, "decision_cancelled", {
    projectId,
    venueId: existing.selectedVenueId,
  });

  return { cancelled: true as const };
}

/**
 * Track C-2: set / clear the wedding date on the active Decision.
 *
 * Accepts an `YYYY-MM-DD` string (the HTML <input type="date"> default)
 * or `null` to clear. Anything else is rejected as user input — never
 * trust the client to hand us a Date instance, especially since
 * Server Actions serialise via JSON.
 *
 * The persisted DateTime is JST midnight; see
 * `src/lib/wedding-countdown.ts` for the reasoning.
 */
const weddingDateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD で入力してください")
    .nullable(),
});

export interface UpdateWeddingDateResult {
  ok: boolean;
  error?: string;
}

export async function updateWeddingDate(
  input: z.input<typeof weddingDateSchema>,
): Promise<UpdateWeddingDateResult> {
  const parsed = weddingDateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "日付の形式が正しくありません" };
  }

  let weddingDate: Date | null = null;
  if (parsed.data.date) {
    weddingDate = parseWeddingDateInput(parsed.data.date);
    if (!weddingDate) {
      return { ok: false, error: "存在しない日付です" };
    }
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // updateMany so an absent Decision (decision not yet made) silently
  // returns count=0 — the UI gates the date input behind the decided
  // state already, so this is just defence in depth.
  try {
    const result = await prisma.decision.updateMany({
      where: { projectId },
      data: { weddingDate },
    });
    if (result.count === 0) {
      return { ok: false, error: "まだ式場が決まっていません" };
    }
  } catch (err) {
    captureError(err, {
      action: "updateWeddingDate",
      projectId,
    });
    return { ok: false, error: "日付の保存に失敗しました" };
  }

  revalidateTag(`project:${projectId}`, { expire: 0 });
  revalidatePath("/home");
  revalidatePath("/journey");

  // Phase 3 L3 wave 1 — broadcast a wedding_date_updated so the
  // partner's open client paints a "{name}さんが挙式日を更新しました"
  // toast and the countdown / journey surface refreshes. Best-effort.
  const actor = await resolveActor(user.id);
  await publishRealtimeEvent(projectId, {
    kind: "wedding_date_updated",
    actor,
    weddingDate: parsed.data.date,
  });

  return { ok: true };
}
