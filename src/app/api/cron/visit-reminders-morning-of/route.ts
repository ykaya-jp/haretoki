import { NextResponse } from "next/server";
import { runVisitReminderCron } from "@/server/cron/visit-reminder-handler";
import { recordCronRun } from "@/lib/cron-audit";

/**
 * GET/POST /api/cron/visit-reminders-morning-of
 *
 * Daily cron pinned to phase=`morning_of`. Vercel cron schedule
 * `0 23 * * *` (UTC) = 08:00 JST next-day morning — notifies couples
 * whose visit lands on today's JST calendar day.
 *
 * UTC 23:00 lands on JST 08:00 of the *next* UTC date, which is exactly
 * the JST "today" we want to notify about. JST has no DST so this
 * mapping is stable year-round.
 *
 * Auth: Bearer CRON_SECRET (same pattern as the four sibling crons).
 */
export const maxDuration = 300;

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
  const result = await runVisitReminderCron("morning_of");
  await recordCronRun("visit-reminders-morning-of", {
    ok: true,
    durationMs: Date.now() - start,
  });
  return NextResponse.json({ phase: "morning_of", ...result });
}
