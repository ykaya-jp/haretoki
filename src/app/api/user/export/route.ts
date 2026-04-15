import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { buildUserExportBundle } from "@/server/actions/user-data";


// GDPR Article 20 — Right to data portability.
// Returns the authenticated user's entire data footprint (profile + project
// + venues + visits + ratings + reviews + favorites + decisions) as a JSON
// bundle the user can download. Auth-scoped: we only expose records this
// user is a project member of.
export async function GET() {
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
