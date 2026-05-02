"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { submitFeedback } from "@/server/actions/feedback";
import { useHaptic } from "@/hooks/use-haptic";

/**
 * Beta feedback form. Mirrors the /support `ContactForm` shape on
 * purpose so couples get a familiar pattern across the two surfaces;
 * the only differences are copy + the optional contact field
 * positioning + the gold-warm "Beta" eyebrow that distinguishes
 * "research" from "incident" intent.
 *
 * No draft persistence — the form is short and a re-send creates a
 * duplicate email on the operator side. Submit + clear is the right
 * one-shot interaction.
 */
interface Props {
  /** The signed-in user's email — pre-fills the contact field as a
   *  ghost placeholder so couples don't have to retype it but ALSO
   *  see clearly that "leave blank = use my registered email". */
  defaultContact: string;
}

export function FeedbackForm({ defaultContact }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [isPending, startTransition] = useTransition();
  const haptic = useHaptic();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;
    startTransition(async () => {
      const result = await submitFeedback({
        subject,
        body,
        contact: contact.trim() || undefined,
      });
      if (result.success) {
        haptic("success");
        toast.success("フィードバックをお預かりしました");
        setSubject("");
        setBody("");
        setContact("");
      } else {
        toast.error(result.error);
      }
    });
  };

  const ready = subject.trim().length >= 2 && body.trim().length >= 10;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label
          htmlFor="feedback-subject"
          className="text-[12px] tracking-wide text-muted-foreground"
        >
          件名
          <span className="ml-1 text-[var(--gold-warm)]" aria-label="必須">
            *
          </span>
        </label>
        <input
          id="feedback-subject"
          type="text"
          autoComplete="off"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={80}
          required
          disabled={isPending}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[var(--gold-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          placeholder="例: 候補ページが使いやすくなった"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="feedback-body"
          className="text-[12px] tracking-wide text-muted-foreground"
        >
          ご意見・ご要望
          <span className="ml-1 text-[var(--gold-warm)]" aria-label="必須">
            *
          </span>
        </label>
        <textarea
          id="feedback-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          required
          rows={7}
          disabled={isPending}
          className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:border-[var(--gold-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          placeholder="気になる点・嬉しかった点・あったらいいなと思った機能、 どんなことでも"
        />
        <p className="text-[11px] text-muted-foreground">
          {body.length} / 4000 字
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="feedback-contact"
          className="text-[12px] tracking-wide text-muted-foreground"
        >
          ご連絡先（任意）
        </label>
        <input
          id="feedback-contact"
          type="email"
          autoComplete="email"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={254}
          disabled={isPending}
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-[var(--gold-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-warm)]/30"
          placeholder={defaultContact || "返信を希望される場合のみ"}
        />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          空欄のときはご登録のメールアドレスへお返事します。 返信を希望されない
          場合は気にせずそのままで構いません。
        </p>
      </div>

      <button
        type="submit"
        disabled={!ready || isPending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium tracking-[0.01em] text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {isPending ? "送信中…" : "フィードバックを送る"}
      </button>
    </form>
  );
}
