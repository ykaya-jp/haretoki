import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, MessageSquareHeart } from "lucide-react";
import { requireUser } from "@/server/auth";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const metadata: Metadata = {
  title: "ご意見・ご要望",
  description: "Beta 期間中のフィードバックをお預かりします。",
};

/**
 * Beta-period feedback page. Editorial chrome (gold eyebrow + Shippori
 * h1 + gradient hairline + back breadcrumb) matches /mypage/family-share
 * and /settings so couples land here without a fresh design context.
 *
 * Form lives in src/components/feedback/feedback-form.tsx. Server
 * action contract + audit verb in src/server/actions/feedback.ts.
 */
export default async function FeedbackPage() {
  const user = await requireUser();
  const defaultContact = user.email ?? "";

  return (
    <div className="space-y-8 pb-[env(safe-area-inset-bottom)]">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <Link
            href="/mypage"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Feedback</span>
        </p>
        <h1 className="mt-2 inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-h1 font-light tracking-[-0.01em]">
          <MessageSquareHeart
            className="h-5 w-5 text-[var(--gold-warm)]"
            aria-hidden="true"
          />
          ご意見・ご要望
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Beta 期間中のおふたりの声が、 これからの晴れ時を作ります。
          <br />
          気になる点・嬉しかった点、 どんなことでもお寄せください。
        </p>
      </header>

      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent 0%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 30%, color-mix(in oklab, var(--gold-warm) 40%, transparent) 70%, transparent 100%)",
        }}
      />

      <div className="rounded-2xl bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)] sm:p-6">
        <FeedbackForm defaultContact={defaultContact} />
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        ※ 不具合のご報告は{" "}
        <Link
          href="/support"
          prefetch={false}
          className="underline-offset-4 hover:underline"
        >
          サポート窓口
        </Link>
        {" "}からのほうが早く対応できます。
      </p>
    </div>
  );
}
