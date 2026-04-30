import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * GET/POST /api/cron/decision-followup
 *
 * F3 - 決定 7 日後「続きから」リマインダー。
 * 日次実行で、以下の条件を満たす project に対し Notification を 1 件作成:
 *   - Decision.decidedAt が 7-8 日前（24h 窓を 1 日だけ跨がせる）
 *   - 未完了 todo が 5-10 件（design §2.6: 押し付けがましさ回避）
 *   - 決定から 30 日以内（超過は "decision_with_open_todos" stage に委ねる）
 *
 * 冪等性: 同じ Decision 行に対して 1 回しか走らないよう、type +
 * userId で今日作成済みかをチェックしてから INSERT する（軽量 dedup）。
 *
 * Auth: Bearer CRON_SECRET。
 */
export const maxDuration = 300;

const FOLLOWUP_DAY_MIN = 7;
const FOLLOWUP_DAY_MAX = 8;
const OPEN_MIN = 5;
const OPEN_MAX = 10;

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const windowStart = new Date(now.getTime() - FOLLOWUP_DAY_MAX * dayMs);
  const windowEnd = new Date(now.getTime() - FOLLOWUP_DAY_MIN * dayMs);

  // Candidates: Decisions decided in the 7-8 day window.
  const candidates = await prisma.decision.findMany({
    where: {
      decidedAt: {
        gte: windowStart,
        lt: windowEnd,
      },
    },
    select: { projectId: true },
  });

  let notified = 0;
  let skipped = 0;

  for (const c of candidates) {
    const openCount = await prisma.decisionTodo.count({
      where: { projectId: c.projectId, completedAt: null },
    });
    if (openCount < OPEN_MIN || openCount > OPEN_MAX) {
      skipped++;
      continue;
    }

    // Send to every accepted project member (owner + partner) — same rule
    // as makeDecision/cancelDecision authorization: either member may act.
    const members = await prisma.projectMember.findMany({
      where: { projectId: c.projectId, acceptedAt: { not: null } },
      select: { userId: true },
    });
    if (members.length === 0) {
      skipped++;
      continue;
    }

    // Simple dedup: skip if any member already has a followup from today.
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const already = await prisma.notification.count({
      where: {
        userId: { in: members.map((m) => m.userId) },
        type: "decision_todo_followup",
        createdAt: { gte: todayStart },
      },
    });
    if (already > 0) {
      skipped++;
      continue;
    }

    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: "decision_todo_followup",
        title: "続きから、どうぞ",
        body: `次の一歩が、まだ ${openCount} つ残っています。朝の 10 分でひとつ進めてみませんか。`,
        href: "/preparation",
      })),
    });
    notified += members.length;
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    candidates: candidates.length,
    notified,
    skipped,
  });
}
