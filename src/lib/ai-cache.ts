/** Input-hash based cache for Claude responses. TTL = 30 days. */

import { prisma } from "@/server/db";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function getCachedResponse(inputHash: string): Promise<string | null> {
  try {
    const row = await prisma.aiCache.findUnique({ where: { inputHash } });
    if (!row) return null;
    if (Date.now() - row.createdAt.getTime() > TTL_MS) return null;
    return row.response;
  } catch {
    return null;
  }
}

export async function setCachedResponse(
  inputHash: string,
  response: string,
  model: string,
): Promise<void> {
  try {
    await prisma.aiCache.upsert({
      where: { inputHash },
      update: { response, model, createdAt: new Date() },
      create: { inputHash, response, model },
    });
  } catch {
    // cache write failure is non-fatal
  }
}
