import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  // TODO: Implement streaming in Phase C
  return NextResponse.json({ error: "Streaming not yet implemented" }, { status: 501 });
}
