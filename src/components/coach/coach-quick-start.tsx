"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Loader2,
  Compass,
  Receipt,
  MessageCircleHeart,
  type LucideIcon,
} from "lucide-react";
import { sendCoachMessage } from "@/server/actions/coach";

interface UseCase {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  prompt: string;
}

const USE_CASES: readonly UseCase[] = [
  {
    title: "式場選びの基準がまだ決まっていない",
    subtitle: "好みや優先順位をAIと一緒に整理",
    icon: Compass,
    prompt:
      "式場選びで迷っています。どんな基準で決めればいいか相談したいです。",
  },
  {
    title: "見積もりの妥当性が不安",
    subtitle: "相場と比べて、上がりそうな項目を先回りで確認",
    icon: Receipt,
    prompt: "見積もりの内容が妥当か相談したいです。",
  },
  {
    title: "ふたりで意見が割れている",
    subtitle: "意見の違いを整理して、納得できる選択を",
    icon: MessageCircleHeart,
    prompt:
      "パートナーと意見が分かれています。どう話し合えばいいか相談したいです。",
  },
] as const;

// Classic fallback prompts kept as compact secondary row.
const SECONDARY_PROMPTS = [
  "予算の相場を知りたい",
  "神前式とチャペルの違いを教えて",
  "ゲスト80人だとどれくらいの会場がいい？",
] as const;

/**
 * Zero-state rescue: shown on /coach when the couple has no venues/insights yet.
 *
 * Three use-case CARDS (primary) answer "when / why should I talk to the AI coach?".
 * Tapping a card pre-fills the ChatBar input via the `?prompt=` URL param — the
 * ChatBar reads the param on mount, focuses the input, and lets the user edit or
 * send. This keeps ChatBar as the single source of truth for the input state
 * without introducing prop drilling through the server-rendered page.
 *
 * A secondary row of compact "他の質問" chips preserves the previous one-tap-send
 * flow for users who want a quick answer.
 */
export function CoachQuickStart() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // Synchronous guard: isPending only flips after React commits, so two
  // same-frame taps (or a fast double-tap on touch) can both pass the
  // `if (isPending) return` check and fire the action twice. A ref flips
  // immediately and is reset in the transition callback below.
  const sendingRef = useRef(false);

  const preFill = (prompt: string) => {
    // Navigate with ?prompt=... so ChatBar's useSearchParams hook picks it up
    // on mount. scroll:false keeps the card position stable after focus.
    const params = new URLSearchParams({ prompt });
    router.replace(`/coach?${params.toString()}`, { scroll: false });
  };

  const sendSecondary = (prompt: string, idx: number) => {
    if (isPending || sendingRef.current) return;
    sendingRef.current = true;
    setActiveIdx(idx);
    startTransition(async () => {
      try {
        const result = await sendCoachMessage(prompt);
        // sendCoachMessage always returns a sessionId (creates one if the
        // user had none). Navigate to /coach?session=<id> so the coach
        // page refetches the session history and the assistant reply
        // actually renders. Previously we just called router.refresh(),
        // which reloaded /coach without session param → currentSession
        // stayed null and the user saw QuickStart with nothing changed.
        if (result.sessionId) {
          router.replace(`/coach?session=${result.sessionId}`, { scroll: true });
          router.refresh();
        } else {
          router.refresh();
        }
      } finally {
        sendingRef.current = false;
      }
    });
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[var(--gold-warm)]" aria-hidden="true" />
        <span className="font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-wide text-foreground">
          どんなこと、話そう？
        </span>
      </div>

      {/* Primary: 3 use-case cards. Stack on mobile, 3-col grid on md+. */}
      <div className="space-y-3 md:grid md:grid-cols-3 md:gap-3 md:space-y-0">
        {USE_CASES.map((uc) => {
          const Icon = uc.icon;
          return (
            <button
              key={uc.title}
              type="button"
              onClick={() => preFill(uc.prompt)}
              aria-label={`${uc.title}。チャット入力欄に質問文を入れます`}
              className="flex min-h-[88px] w-full flex-col gap-2 rounded-2xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-5 text-left transition-all duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <Icon
                aria-hidden="true"
                className="h-5 w-5 text-[var(--gold-warm)]"
                strokeWidth={1.5}
              />
              <div className="space-y-1">
                <h3 className="font-serif text-sm font-medium leading-snug text-foreground">
                  {uc.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {uc.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Secondary: classic short prompts (one-tap send). */}
      <div className="space-y-2">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">ほかの質問</p>
        <div className="flex flex-wrap gap-2">
          {SECONDARY_PROMPTS.map((prompt, idx) => {
            const loading = isPending && activeIdx === idx;
            return (
              <button
                key={prompt}
                type="button"
                disabled={isPending}
                onClick={() => sendSecondary(prompt, idx)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs transition-all active:scale-[0.98] hover:shadow-sm disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-[var(--gold-warm)]" />
                )}
                <span>{prompt}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
