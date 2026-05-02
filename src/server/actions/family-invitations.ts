"use server";

import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db";
import { requireUser, requireOwner } from "@/server/auth";
import { recordAudit, redactIp, extractRequestMeta } from "@/server/audit";
import { captureError, captureMessage } from "@/lib/sentry";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  FAMILY_TOKEN_BYTES,
  FAMILY_DEFAULT_EXPIRY_DAYS,
  FAMILY_VIEW_RATE_LIMIT,
  FAMILY_SHOWCASE_DIMENSIONS,
} from "@/lib/family-invitations-config";

/**
 * Track C-1: family read-only invitation links.
 *
 * Why a separate model from ProjectInvitation (E-11):
 *   - ProjectInvitation grants OAuth-gated WRITE membership (the
 *     partner becomes a ProjectMember). Single-consume.
 *   - FamilyInvitation grants public, no-auth, READ-ONLY decision view.
 *     Multi-consume (the family group passes the URL around).
 *   The two have opposite security postures so they live in opposite
 *   modules; cross-imports are an architectural smell here.
 *
 * Designer-flagged guards (B-2 designer warning carries over):
 *   - 32-byte (256-bit) crypto-random token
 *   - default 30-day expiry; old links die without owner action
 *   - explicit revoke API
 *   - per-IP rate limit on the public consume path (10/min)
 *   - audit log on every lifecycle event (created / viewed / revoked)
 *   - viewCount is incremented in a single SQL update so a flood of
 *     concurrent hits can't read-modify-write tear it
 *   - last_viewed_ip is stored as a sha256 hash of the *redacted* /24
 *     network — owner can spot "different network is hitting this"
 *     without ever holding the raw client address
 */


export interface FamilyInvitationLink {
  id: string;
  url: string;
  token: string;
  /** ISO timestamp. */
  expiresAt: string;
  /** ISO. */
  createdAt: string;
  /** ISO. Set when the owner revokes; the public route then 404s. */
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

function appUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return base.replace(/\/$/, "");
}

function buildShareUrl(token: string): string {
  const base = appUrl();
  return base ? `${base}/family/${token}` : `/family/${token}`;
}

function toLink(row: {
  id: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
}): FamilyInvitationLink {
  return {
    id: row.id,
    token: row.token,
    url: buildShareUrl(row.token),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    viewCount: row.viewCount,
    lastViewedAt: row.lastViewedAt ? row.lastViewedAt.toISOString() : null,
  };
}

/**
 * Owner: list all family links for this project (newest first). Used by
 * the mypage management UI. Does NOT auto-purge expired/revoked rows;
 * the owner can still see history (with badges) until the retention
 * sweep cleans them up.
 */
export async function listFamilyInvitations(): Promise<FamilyInvitationLink[]> {
  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  const rows = await prisma.familyInvitation.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      createdAt: true,
      revokedAt: true,
      viewCount: true,
      lastViewedAt: true,
    },
    take: 20,
  });
  return rows.map(toLink);
}

/**
 * Owner: issue a new family link. Revokes any prior live (unrevoked +
 * unexpired) link for this project so attackers can only ever target a
 * single window. Returns the new link in the same shape the
 * management UI consumes.
 */
export async function createFamilyInvitation(): Promise<{
  ok: boolean;
  link?: FamilyInvitationLink;
  error?: string;
}> {
  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  // Generate the token in-memory before touching the DB so a generator
  // failure can't leave half-state. randomBytes throws on entropy
  // exhaustion; let it propagate and surface as a 500 — the alternative
  // (silent retry with weaker randomness) is worse.
  const token = randomBytes(FAMILY_TOKEN_BYTES).toString("hex");
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + FAMILY_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Mark prior live links as revoked so only the newest is active.
      // Past-expired and already-revoked links are left untouched —
      // their state is already terminal.
      await tx.familyInvitation.updateMany({
        where: {
          projectId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now, revokedBy: user.id },
      });
      return tx.familyInvitation.create({
        data: {
          projectId,
          token,
          createdBy: user.id,
          expiresAt,
        },
        select: {
          id: true,
          token: true,
          expiresAt: true,
          createdAt: true,
          revokedAt: true,
          viewCount: true,
          lastViewedAt: true,
        },
      });
    });

    await recordAudit({
      action: "family.invitation.created",
      actorId: user.id,
      actorRole: "user",
      target: { type: "family_invitation", id: created.id },
      detail: { projectId, expiresAt: expiresAt.toISOString() },
    });
    revalidatePath("/mypage/family-share");

    return { ok: true, link: toLink(created) };
  } catch (err) {
    captureError(err, {
      component: "auth",
      alertRoute: "p2-email",
      extra: { action: "family-invitation:create", projectId },
    });
    return { ok: false, error: "リンクの発行に失敗しました" };
  }
}

const revokeSchema = z.object({
  id: z.string().uuid("リンク ID が不正です"),
});

export async function revokeFamilyInvitation(
  input: z.input<typeof revokeSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "リンク ID が不正です" };
  }

  const user = await requireUser();
  const { projectId } = await requireOwner(user.id);

  try {
    // updateMany so an attempt to revoke someone else's link silently
    // does nothing rather than leaking the existence of the other
    // project's row via a Prisma "Record not found" error.
    const result = await prisma.familyInvitation.updateMany({
      where: { id: parsed.data.id, projectId, revokedAt: null },
      data: { revokedAt: new Date(), revokedBy: user.id },
    });
    if (result.count === 0) {
      // Either wrong project, already revoked, or fabricated id. Treat
      // all three the same to avoid an enumeration oracle.
      return { ok: true };
    }
    await recordAudit({
      action: "family.invitation.revoked",
      actorId: user.id,
      actorRole: "user",
      target: { type: "family_invitation", id: parsed.data.id },
      detail: { projectId },
    });
    revalidatePath("/mypage/family-share");
    return { ok: true };
  } catch (err) {
    captureError(err, {
      component: "auth",
      alertRoute: "p2-email",
      extra: { action: "family-invitation:revoke", projectId },
    });
    return { ok: false, error: "リンクの取り消しに失敗しました" };
  }
}

/**
 * Public payload returned to the read-only family view. Carefully
 * scoped — never include cost / private memos / partner-only ratings
 * etc. Adding a new field here is a security review trigger.
 */
export interface FamilyDecisionPayload {
  venueName: string;
  venueLocation: string | null;
  /** Decided-at JST date string (M月D日). Year intentionally omitted. */
  decidedOnLabel: string;
  rationale: string | null;
  /** Curated dimension scores (0-5). Cost is intentionally absent. */
  scores: Array<{ dimension: string; score: number }>;
}

export type ConsumeFamilyResult =
  | { ok: true; payload: FamilyDecisionPayload }
  | { ok: false; reason: "not-found" | "expired" | "revoked" | "rate-limited" };

/**
 * Public path: a visitor with the URL hits this through the
 * `/family/[token]` route. Auth-free. Designer-warned protections live
 * here:
 *   - per-IP rate limit (10/min) so a leak doesn't become a DoS / view-
 *     count flood
 *   - explicit `expiresAt` + `revokedAt` checks (the DB doesn't enforce
 *     these — they're application invariants)
 *   - viewCount bump in a single UPDATE (`{ increment: 1 }`) so
 *     concurrent hits don't tear the counter
 *   - audit log row per successful view, action=family.invitation.viewed
 */
export async function consumeFamilyInvitationView(
  token: string,
): Promise<ConsumeFamilyResult> {
  // Token shape guard — early reject of obvious garbage so the rate
  // limiter and DB don't process noise. 64 hex chars = the exact shape
  // we generate. We don't 422 here on mismatch — return not-found so
  // the public response is identical to "valid-shape but unknown".
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return { ok: false, reason: "not-found" };
  }

  const reqHeaders = await headers();
  const meta = extractRequestMeta({
    headers: { get: (n) => reqHeaders.get(n) },
  });
  const redacted = redactIp(meta.ip);
  // Rate limit by /24 network — keys off the same coarsened IP we'll
  // store in the audit row. Falls back to a per-token bucket if the
  // request has no parseable IP (preview tunnels, dev). Either way one
  // attacker can't burst more than 10 hits a minute.
  const rateKey = `family-view:${redacted ?? `token:${token.slice(0, 12)}`}`;
  const rl = await checkRateLimit(rateKey, FAMILY_VIEW_RATE_LIMIT);
  if (!rl.allowed) {
    captureMessage("[family-invitation] rate limited", {
      level: "warning",
      component: "auth",
      alertRoute: "p3-digest",
      extra: { rateKey, retryAfterSec: rl.retryAfterSec },
    });
    return { ok: false, reason: "rate-limited" };
  }

  const row = await prisma.familyInvitation.findUnique({
    where: { token },
    select: {
      id: true,
      projectId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (!row) return { ok: false, reason: "not-found" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const decision = await prisma.decision.findUnique({
    where: { projectId: row.projectId },
    select: {
      decidedAt: true,
      rationale: true,
      venue: {
        select: {
          name: true,
          location: true,
          scores: {
            where: {
              dimension: { in: FAMILY_SHOWCASE_DIMENSIONS.map((d) => d.key) },
            },
            select: { dimension: true, score: true },
          },
        },
      },
    },
  });

  // The owner shared a link before deciding. Treat as not-found so the
  // public view doesn't reveal "you're early — keep checking back" (an
  // information leak).
  if (!decision) return { ok: false, reason: "not-found" };

  // Counter bump: single UPDATE so the hot path is one round-trip and
  // concurrent views can't tear the count. Best-effort — failure here
  // shouldn't 500 the public page.
  prisma.familyInvitation
    .update({
      where: { id: row.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
        lastViewedIpHash: hashRedactedIp(redacted),
      },
    })
    .catch((err) => {
      captureError(err, {
        component: "db",
        alertRoute: "p3-digest",
        extra: { action: "family-invitation:viewcount-bump", id: row.id },
      });
    });

  // Audit log row, best-effort.
  void recordAudit({
    action: "family.invitation.viewed",
    actorId: row.id, // anonymous viewer — anchor the row by invitation id
    actorRole: "system",
    target: { type: "family_invitation", id: row.id },
    request: { ip: meta.ip, userAgent: meta.userAgent },
    detail: { projectId: row.projectId },
  });

  return {
    ok: true,
    payload: {
      venueName: decision.venue.name,
      venueLocation: decision.venue.location,
      decidedOnLabel: formatJstMonthDay(decision.decidedAt),
      rationale: decision.rationale,
      scores: FAMILY_SHOWCASE_DIMENSIONS.map((d) => {
        const row = decision.venue.scores.find((s) => s.dimension === d.key);
        return {
          dimension: d.label,
          score: row ? Number(row.score) : 0,
        };
      }).filter((s) => s.score > 0),
    },
  };
}

function hashRedactedIp(redacted: string | null): string | null {
  if (!redacted) return null;
  return createHash("sha256").update(redacted).digest("hex").slice(0, 16);
}

/** "5月16日" — year intentionally dropped per the family payload contract. */
function formatJstMonthDay(d: Date): string {
  const shifted = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${shifted.getUTCMonth() + 1}月${shifted.getUTCDate()}日`;
}

