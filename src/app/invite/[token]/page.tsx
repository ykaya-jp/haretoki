import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { consumeInvitationLink } from "@/server/actions/invitation-links";
import { prisma } from "@/server/db";

/**
 * E-11 1-tap invitation landing.
 *
 * Flow:
 *   1. Not authed → render a friendly welcome page with a CTA to sign up
 *      (next={/invite/[token]} so we come back here after OAuth).
 *   2. Authed + valid token → consume, redirect /home?invited=1.
 *   3. Authed + invalid/expired → render a quiet error card (no PII leak).
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate token shape early — 64 hex chars.
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <InvalidCard reason="invalid" />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Unauthenticated — show the invitation card + sign-up CTA.
    // Resolve inviter name / project name first so the stranger sees a
    // concrete "who / where" instead of a blank token.
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
    if (invitation.consumedAt) return <InvalidCard reason="stale" />;
    const now = new Date();
    if (invitation.expiresAt < now) return <InvalidCard reason="expired" />;

    const inviterName =
      invitation.creator.name ??
      invitation.creator.email.split("@")[0] ??
      "ふたりのひとり";

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
            {inviterName}さんから、
            <br />
            式場さがしへの招待です。
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            ログインすると、おふたりの場所に合流できます。
            <br />
            メールアドレスの事前一致は不要です。
          </p>

          <div className="space-y-2.5">
            <Link
              href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition"
            >
              ふたりの場所に入る
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
              className="inline-flex h-11 w-full items-center justify-center text-[13px] text-muted-foreground underline-offset-4 hover:underline"
            >
              すでにアカウントをお持ちの方は、ログイン
            </Link>
          </div>

          <p className="text-[11px] text-muted-foreground/70">
            このリンクは{" "}
            {new Date(invitation.expiresAt).toLocaleDateString("ja-JP")}
            {" "}まで有効です。
          </p>
        </div>
      </div>
    );
  }

  // Authenticated — try to consume.
  const result = await consumeInvitationLink(token);
  if (result.ok) {
    redirect("/home?invited=1");
  }

  return <InvalidCard reason={result.reason} />;
}

function InvalidCard({
  reason,
}: {
  reason: "invalid" | "expired" | "stale" | "self";
}) {
  const messages = {
    invalid: "このリンクは、うまく読み取れませんでした。送ってくれた方に、もう一度お伝えください。",
    expired: "このリンクは、有効期限が切れてしまいました。新しい招待リンクをお待ちください。",
    stale: "先にお相手が合流したようです。よかったらホームで、そっとお迎えください。",
    self: "ご自身で作ったリンクは、ご自身ではお使いになれません。パートナーにお渡しください。",
  };

  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-6 py-10">
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
