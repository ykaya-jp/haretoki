import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { buildUserExportBundle } from "@/server/actions/user-data";
import { detectBot } from "@/lib/botid";


// GDPR Article 20 — Right to data portability.
// Returns the authenticated user's entire data footprint (profile + project
// + venues + visits + ratings + reviews + favorites + decisions) as a JSON
// bundle the user can download. Auth-scoped: we only expose records this
// user is a project member of.
//
// BotID gate — data exfiltration via export is the obvious abuse path
// for a stolen session cookie; checking before the bundle assembly
// (which fans out across half a dozen tables) saves DB load too.
export async function GET() {
  const bot = await detectBot("user-export");
  if (bot.blocked) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const user = await requireUser();

  const bundle = await buildUserExportBundle(prisma, user.id);

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="haretoki-data-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
