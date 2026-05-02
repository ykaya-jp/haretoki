import { NextResponse } from "next/server";
import { generateRitualsForAllActiveProjects } from "@/server/actions/ritual";
import { recordCronRun } from "@/lib/cron-audit";

/**
 * POST /api/cron/generate-rituals
 *
 * Vercel Cron entry. Generates today's DailyRitual for every active project.
 * Idempotent — re-running produces no extra Claude calls (rows already
 * upserted today are skipped).
 *
 * Auth: requires Bearer token matching `CRON_SECRET`. Vercel Cron sends
 * this header automatically when configured via `vercel.json crons[]`.
 */
// Up to 5 min — N projects × Claude latency
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
  const result = await generateRitualsForAllActiveProjects();
  const durationMs = Date.now() - start;

  await recordCronRun("generate-rituals", { ok: true, durationMs });
  return NextResponse.json({ ok: true, durationMs, ...result });
}
