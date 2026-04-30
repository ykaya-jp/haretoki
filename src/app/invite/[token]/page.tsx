import { redirect } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { consumeInvitationLink } from "@/server/actions/invitation-links";
import { prisma } from "@/server/db";
import {
  GUEST_COOKIE_NAME,
  verifyGuestSession,
} from "@/lib/guest-session";

/**
 * F4 1-tap invitation landing.
 *
 * Flow (rewritten for Level 1 guest support):
 *   1. Authed + already-consumed (stale) → quietly redirect /home so the
 *      partner doesn't see an error card for "you already joined".
 *   2. Authed + valid → previous behavior: consume, redirect /home?invited=1.
 *      When consume returns `already_joined`, surface a confirm page.
 *   3. Unauthed + invalid/expired/stale → generic InvalidCard (enumeration
 *      mitigation: invalid + stale are rendered identically).
 *   4. Unauthed + valid → welcome card with TWO CTAs:
 *          - 「ここだけ見る」 → POST /invite/[token]/guest-start (cookie)
 *          - 「参加する」    → /signup?next=/invite/[token]
 *      When `?confirm=join` is set, show Level 3 昇格 confirm before signup.
 *      When `?switch=1`        is set, show cross-project confirm
 *      before issuing a replacement guest cookie.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirm?: string; switch?: string }>;
}) {
  await connection();
  const { token } = await params;
  const { confirm, switch: switchParam } = await searchParams;

  // Validate token shape early — 64 hex chars.
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <InvalidCard reason="invalid" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Authed path ──────────────────────────────────────────────────
  if (user) {
    // Peek before consuming so "stale" (already joined) doesn't show a
    // hostile error. The consume call itself also returns stale, but we
    // want the authed-path redirect to be silent.
    const peek = await prisma.projectInvitation.findUnique({
      where: { token },
      select: { consumedAt: true, consumedBy: true },
    });
    if (peek?.consumedAt && peek.consumedBy === user.id) {
      redirect("/home");
    }

    // Level 3 合流 confirm — partner must acknowledge before we flip
    // ProjectInvitation.consumedAt. Stops silent auto-join when the
    // link is forwarded.
    if (confirm !== "join") {
      const invitation = await prisma.projectInvitation.findUnique({
        where: { token },
        select: {
          expiresAt: true,
          consumedAt: true,
          creator: { select: { name: true, email: true } },
          project: { select: { name: true } },
        },
      });
      if (!invitation) return <InvalidCard reason="invalid" />;
      if (invitation.consumedAt) redirect("/home");
      if (invitation.expiresAt < new Date()) return <InvalidCard reason="expired" />;
      const inviterName =
        invitation.creator.name ??
        invitation.creator.email.split("@")[0] ??
        "パートナー";
      return <JoinConfirmCard token={token} inviterName={inviterName} />;
    }

    const result = await consumeInvitationLink(token);
    if (result.ok) {
      redirect("/home?invited=1");
    }
    if (result.reason === "stale") {
      // Stale but authed → quiet redirect (design §2.5)
      redirect("/home");
    }
    return <InvalidCard reason={result.reason} />;
  }

  // ── Unauthed path ────────────────────────────────────────────────
  const invitation = await prisma.projectInvitation.findUnique({
    where: { token },
    select: {
      expiresAt: true,
      consumedAt: true,
      creator: { select: { name: true, email: true } },
      project: { select: { name: true } },
    },
  });

  // Enumeration mitigation: invalid / stale are rendered identically so
  // an attacker can't distinguish "token doesn't exist" from "already
  // used". Only expired gets a distinct card (owner can re-issue).
  if (!invitation) return <InvalidCard reason="invalid" />;
  if (invitation.consumedAt) return <InvalidCard reason="invalid" />;
  if (invitation.expiresAt < new Date()) return <InvalidCard reason="expired" />;

  const inviterName =
    invitation.creator.name ??
    invitation.creator.email.split("@")[0] ??
    "ふたりのひとり";

  // Cross-project switch confirm (design §4.5): when a guest cookie
  // already points to another project, ask before overwriting.
  if (switchParam === "1") {
    const cookieStore = await cookies();
    const raw = cookieStore.get(GUEST_COOKIE_NAME)?.value;
    const verified = verifyGuestSession(raw);
    if (verified && verified.payload.projectId !== undefined) {
      const otherProject = await prisma.project.findUnique({
        where: { id: verified.payload.projectId },
        select: {
          name: true,
          members: {
            where: { role: "owner" },
            select: { user: { select: { name: true, email: true } } },
          },
        },
      });
      const otherInviterName =
        otherProject?.members[0]?.user?.name ??
        otherProject?.members[0]?.user?.email?.split("@")[0] ??
        "前のパートナー";
      return (
        <SwitchConfirmCard
          token={token}
          currentInviterName={otherInviterName}
          currentProjectName={otherProject?.name ?? "ふたりの式場さがし"}
          newInviterName={inviterName}
        />
      );
    }
  }

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[360px] space-y-6 text-center">
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="mx-2 opacity-30">·</span>
          <span>Invitation</span>
        </p>
        <div
          aria-hidden="true"
          className="mx-auto h-px w-24"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 45%, transparent) 50%, transparent 100%)",
          }}
        />
        <h1 className="font-[family-name:var(--font-display)] text-[24px] font-light leading-[1.35] tracking-[-0.005em]">
          こんにちは、
          <br />
          <span className="font-normal">{inviterName}さんの相棒さん</span>。
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {inviterName}さんが、ふたりで選ぶ場所に招いてくれました。
          <br />
          まずは、ちょっと覗いてみますか。
        </p>

        <div className="space-y-2.5">
          {/* Primary: Level 1 guest view — POST to keep the cookie-
             setting surface server-only (no JS required). */}
          <form action={`/invite/${token}/guest-start`} method="post">
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-[14px] border bg-background text-[14.5px] font-medium active:scale-[0.98] transition"
              style={{
                borderColor: "color-mix(in oklab, var(--gold-warm) 55%, transparent)",
                color: "var(--gold-warm)",
              }}
            >
              ここだけ見る
            </button>
          </form>
          <Link
            href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-flex h-11 w-full items-center justify-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          >
            参加する(アカウントを作る)
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground/70">
          アカウント登録は後からでも大丈夫です。
          <br />
          このリンクは{" "}
          {new Date(invitation.expiresAt).toLocaleDateString("ja-JP")}
          {" "}まで有効です。
        </p>
      </div>
    </div>
  );
}

// ── UI fragments ──────────────────────────────────────────────────

/**
 * Level 3 合流 confirm — the partner is authed but we insist on a
 * deliberate "合流しますか？" tap before consuming the token. Guards
 * against link forwarding + silent auto-join (design §2.6, §4.5).
 */
function JoinConfirmCard({
  token,
  inviterName,
}: {
  token: string;
  inviterName: string;
}) {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[360px] space-y-6 text-center">
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="mx-2 opacity-30">·</span>
          <span>Join</span>
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.4]">
          {inviterName}さんの相棒として、
          <br />
          合流しますか？
        </h1>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          合流すると、{inviterName}さんと同じ式場さがしに参加できます。
          <br />
          ご自身の印象やハートも、ここに残せるようになります。
        </p>
        <div className="space-y-2.5">
          <Link
            href={`/invite/${token}?confirm=join`}
            className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition"
          >
            合流する
          </Link>
          <Link
            href="/home"
            className="inline-flex h-11 w-full items-center justify-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          >
            いまはやめておく
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Cross-project switch confirm (design §4.5). Partner previously opened
 * a guest session for owner A; now tapping owner B's link. We preserve
 * A's cookie until they explicitly say "switch".
 */
function SwitchConfirmCard({
  token,
  currentInviterName,
  currentProjectName,
  newInviterName,
}: {
  token: string;
  currentInviterName: string;
  currentProjectName: string;
  newInviterName: string;
}) {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-6 py-10">
      <div className="w-full max-w-[360px] space-y-6 text-center">
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="mx-2 opacity-30">·</span>
          <span>Switch</span>
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.45]">
          いまは {currentInviterName} さんの
          <br />
          「{currentProjectName}」を見ています。
          <br />
          {newInviterName} さんの招待に
          <br />
          切り替えますか？
        </h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          切り替えると、{currentInviterName}さんの見ていた画面は閉じます。
          もう一度見るには、{currentInviterName}さんのリンクをもう一度タップしてください。
        </p>
        <div className="space-y-2.5">
          <form action={`/invite/${token}/guest-start?confirm=1`} method="post">
            <button
              type="submit"
              className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition"
            >
              {newInviterName}さんの招待に切り替える
            </button>
          </form>
          <Link
            href={`/invite/${token}/view`}
            className="inline-flex h-11 w-full items-center justify-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
          >
            いまの画面にもどる
          </Link>
        </div>
      </div>
    </div>
  );
}

function InvalidCard({
  reason,
}: {
  reason: "invalid" | "expired" | "stale" | "self" | "already_joined";
}) {
  // §2.6 enumeration mitigation: invalid + stale share copy so attackers
  // can't distinguish "token missing" from "token consumed". Only
  // expired + self + already_joined warrant distinct messages because
  // each points at a real recovery action.
  const messages: Record<typeof reason, string> = {
    invalid:
      "このリンクは、うまく読み取れませんでした。送ってくれた方に、もう一度お伝えください。",
    stale:
      "このリンクは、うまく読み取れませんでした。送ってくれた方に、もう一度お伝えください。",
    expired:
      "このリンクは、有効期限が切れてしまいました。新しい招待リンクをお願いしてください。",
    self: "ご自身で作ったリンクは、ご自身ではお使いになれません。パートナーにお渡しください。",
    already_joined:
      "すでに別の式場さがしに参加しています。パートナーと同じ場所に合流するには、ご本人にもう一度招待をお願いしてください。",
  };

  return (
    <div
      className="flex min-h-[70dvh] items-center justify-center px-6 py-10"
      role="alert"
      aria-live="polite"
    >
      <div className="w-full max-w-[360px] space-y-5 text-center">
        <p className="text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
          Invitation
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-[20px] font-light leading-[1.45]">
          この招待は、お渡しできませんでした。
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {messages[reason]}
        </p>
        <Link
          href="/home"
          className="inline-flex h-11 items-center justify-center rounded-[14px] bg-primary px-6 text-[13px] font-medium text-primary-foreground"
        >
          ホームへ
        </Link>
      </div>
    </div>
  );
}
