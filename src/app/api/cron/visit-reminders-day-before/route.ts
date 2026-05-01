import { NextResponse } from "next/server";
import { runVisitReminderCron } from "@/server/cron/visit-reminder-handler";

/**
 * GET/POST /api/cron/visit-reminders-day-before
 *
 * Daily cron pinned to phase=`day_before`. Vercel cron schedule
 * `0 10 * * *` (UTC) = 19:00 JST evening — notifies couples whose
 * visit lands on the next JST calendar day.
 *
 * Auth: Bearer CRON_SECRET (same pattern as the four sibling crons).
 *
 * Hobby plan note: this is one of two replacements for the original
 * hourly visit-reminders cron, which Hobby's daily-only granularity
 * couldn't host. The two daily endpoints together cover day_before +
 * morning_of; before_departure (~2h prior) is dropped under this plan.
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

  const result = await runVisitReminderCron("day_before");
  return NextResponse.json({ phase: "day_before", ...result });
}
