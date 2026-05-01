"use client";

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitSupportMessage } from "@/server/actions/support";

interface Props {
  /** The signed-in user's email — used as the default Reply-To so couples
   *  don't have to retype it. They can override in the optional field. */
  defaultReplyTo: string;
}

/**
 * Contact form for the /support page. Pairs with submitSupportMessage
 * (Server Action). State is intentionally local — there is no draft
 * persistence because the form is short and a re-send would create a
 * duplicate email on the operator side; saving drafts would surface a
 * "do you want to restore?" prompt that is more disruptive than helpful
 * for a one-shot interaction.
 */
export function ContactForm({ defaultReplyTo }: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState(defaultReplyTo);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const result = await submitSupportMessage({
        subject,
        message,
        replyTo: replyTo.trim() || undefined,
      });
      if (result.success) {
        toast.success("お問い合わせを送信しました。3 営業日以内にお返事します。");
        setSubject("");
        setMessage("");
      } else {
        toast.error(result.error);
      }
    });
  };

  // Disable the button when required fields are missing so the visual
  // affordance matches the server-side validation messages.
  const ready = subject.trim().length >= 2 && message.trim().length >= 10;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label
          htmlFor="support-subject"
          className="text-[12px] tracking-wide text-muted-foreground"
        >
          件名
          <span className="ml-1 text-[var(--gold-warm)]" aria-label="必須">
            *
          </span>
        </label>
        <input
          id="support-subject"
          type="text"
          autoComplete="off"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={80}
          required
          disabled={isPending}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[var(--gold-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          placeholder="例: 招待メールが届かない"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="support-message"
          className="text-[12px] tracking-wide text-muted-foreground"
        >
          ご相談内容
          <span className="ml-1 text-[var(--gold-warm)]" aria-label="必須">
            *
          </span>
        </label>
        <textarea
          id="support-message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          required
          disabled={isPending}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-[var(--gold-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          placeholder="どんなことで困っていらっしゃいますか？画面の URL や、起きた時刻も書いていただけると調査がスムーズです。"
        />
        <p className="text-right text-[11px] tabular-nums text-muted-foreground">
          {message.length} / 4000
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="support-reply-to"
          className="text-[12px] tracking-wide text-muted-foreground"
        >
          返信先のメールアドレス
        </label>
        <input
          id="support-reply-to"
          type="email"
          autoComplete="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          disabled={isPending}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[var(--gold-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          placeholder={defaultReplyTo || "you@example.com"}
        />
        <p className="text-[11px] text-muted-foreground">
          空欄のままなら、ログイン中のメールアドレスにお返事します。
        </p>
      </div>

      <button
        type="submit"
        disabled={!ready || isPending}
        aria-busy={isPending}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold-warm)] px-4 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--gold-warm)]/90 active:scale-[0.98] disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-4 w-4" aria-hidden="true" />
        )}
        {isPending ? "送信しています…" : "送信する"}
      </button>
    </form>
  );
}
