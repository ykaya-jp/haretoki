import { NextResponse } from "next/server";
import { runVisitReminderCron } from "@/server/cron/visit-reminder-handler";

/**
 * GET/POST /api/cron/visit-reminders-way-home
 *
 * Daily cron pinned to phase=`way_home`. Vercel cron schedule
 * `0 13 * * *` (UTC) = 22:00 JST evening — nudges couples whose visit
 * happened earlier today (JST) to leave a memo while impressions are fresh.
 *
 * Auth: Bearer CRON_SECRET (same pattern as the two sibling crons).
 *
 * Hobby-plan note: this completes the 3-phase set (day_before / morning_of /
 * way_home). Each fires once per JST day at its own UTC hour. The original
 * design called for 5-minute-tick crons at the literal T-24h / T-1h / T+30m
 * offsets — that requires Pro-plan minute-granular cron which we haven't
 * upgraded to. The daily-only baseline approximates each timing within the
 * relevant ergonomic window (evening prep / morning prep / evening recap).
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

  const result = await runVisitReminderCron("way_home");
  return NextResponse.json({ phase: "way_home", ...result });
}
