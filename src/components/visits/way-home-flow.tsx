"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sun, CloudSun, Cloud, CloudFog } from "lucide-react";
import { toast } from "sonner";
import { submitWayHome } from "@/server/actions/way-home";
import { cn } from "@/lib/utils";

type Step = "mood" | "good" | "concern" | "done";

interface WayHomeFlowProps {
  visitId: string;
  venueName: string;
}

const MOOD_OPTIONS = [
  { value: 5, Icon: Sun, label: "晴れやか", sub: "とても良かった" },
  { value: 4, Icon: CloudSun, label: "明るめ", sub: "良かった方" },
  { value: 3, Icon: Cloud, label: "もやもや", sub: "迷いが残る" },
  { value: 2, Icon: CloudFog, label: "合わなかった", sub: "次を見たい" },
] as const;

const GOOD_TAGS = [
  "料理",
  "空間",
  "スタッフ",
  "光・景色",
  "演出提案",
  "プラン",
  "アクセス",
];
const CONCERN_TAGS = [
  "費用",
  "雰囲気",
  "アクセス",
  "スタッフ",
  "プラン制約",
  "駐車場",
];

export function WayHomeFlow({ visitId, venueName }: WayHomeFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("mood");
  const [mood, setMood] = useState<number>(0);
  const [goodTags, setGoodTags] = useState<string[]>([]);
  const [goodNote, setGoodNote] = useState("");
  const [concernTags, setConcernTags] = useState<string[]>([]);
  const [concernNote, setConcernNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const progressPct =
    step === "mood" ? 33 : step === "good" ? 66 : step === "concern" ? 100 : 100;

  const next = () => {
    if (step === "mood") setStep("good");
    else if (step === "good") setStep("concern");
    else if (step === "concern") handleSubmit();
  };

  const back = () => {
    if (step === "good") setStep("mood");
    else if (step === "concern") setStep("good");
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await submitWayHome(visitId, {
        mood,
        goodTags,
        goodNote: goodNote.trim() || undefined,
        concernTags,
        concernNote: concernNote.trim() || undefined,
      });
      if (result.ok) {
        toast.success("印象を残しました");
        setStep("done");
        setTimeout(() => router.push(`/venues/${visitId}`), 900);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSkip = () => {
    router.back();
  };

  const toggleTag = (setter: (v: string[]) => void, current: string[], tag: string) => {
    setter(current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 pt-5 pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          {step !== "mood" && step !== "done" && (
            <button
              type="button"
              onClick={back}
              aria-label="前に戻る"
              className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[11.5px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
              <span aria-hidden="true" className="opacity-30">·</span>
              <span>After</span>
              <span aria-hidden="true" className="opacity-30">·</span>
              <span className="truncate normal-case tracking-normal">{venueName}</span>
            </p>
          </div>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {step === "mood" ? "1" : step === "good" ? "2" : "3"} / 3
          </span>
        </div>
        <div className="mt-2 h-[2px] w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-[var(--gold-warm)] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        {step === "mood" && (
          <section>
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.4] tracking-[-0.005em]">
              今の気持ちは？
            </h1>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
              見学直後の第一印象。深く考えず直感で。
            </p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {MOOD_OPTIONS.map((opt) => {
                const sel = mood === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMood(opt.value)}
                    aria-pressed={sel}
                    aria-label={opt.label}
                    className={cn(
                      "transform-gpu flex min-h-[110px] flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-4 transition-all duration-200 ease-out active:scale-[0.98]",
                      sel &&
                        "bg-[var(--gold-subtle)] border-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)] shadow-sm",
                    )}
                  >
                    <opt.Icon
                      className={cn(
                        "h-8 w-8",
                        sel ? "text-[var(--gold-warm)]" : "text-muted-foreground",
                      )}
                      strokeWidth={1.3}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "text-[13px] font-medium",
                        sel ? "text-[var(--gold-warm)]" : "text-foreground",
                      )}
                    >
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {step === "good" && (
          <section>
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.4]">
              一番よかったのは？
            </h1>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              3 つまで選べます
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {GOOD_TAGS.map((t) => {
                const sel = goodTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      goodTags.length < 3 || sel
                        ? toggleTag(setGoodTags, goodTags, t)
                        : toast.info("3 つまで選べます")
                    }
                    aria-pressed={sel}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] transition active:scale-[0.98]",
                      sel
                        ? "bg-[var(--gold-subtle)] text-[var(--gold-warm)] border-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)]"
                        : "bg-card text-foreground",
                    )}
                  >
                    {sel && "✓ "}
                    {t}
                  </button>
                );
              })}
            </div>
            <textarea
              value={goodNote}
              onChange={(e) => setGoodNote(e.target.value)}
              placeholder="具体的に覚えていること (任意)&#10;例: コース料理の前菜が忘れられない…"
              rows={3}
              maxLength={1000}
              className="mt-5 w-full rounded-2xl border border-border bg-card p-4 text-[13.5px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[var(--gold-warm)]/40"
            />
          </section>
        )}

        {step === "concern" && (
          <section>
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.4]">
              引っかかったことは？
            </h1>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              なければスキップで OK
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {CONCERN_TAGS.map((t) => {
                const sel = concernTags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(setConcernTags, concernTags, t)}
                    aria-pressed={sel}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[13px] transition active:scale-[0.98]",
                      sel
                        ? "bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] text-[color:var(--destructive)] border-[color-mix(in_oklab,var(--destructive)_45%,transparent)]"
                        : "bg-card text-foreground",
                    )}
                  >
                    {sel && "✓ "}
                    {t}
                  </button>
                );
              })}
            </div>
            <textarea
              value={concernNote}
              onChange={(e) => setConcernNote(e.target.value)}
              placeholder="もっと詳しく (任意)"
              rows={3}
              maxLength={1000}
              className="mt-5 w-full rounded-2xl border border-border bg-card p-4 text-[13.5px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-[var(--destructive)]/40"
            />
          </section>
        )}

        {step === "done" && (
          <section className="flex flex-col items-center gap-4 py-16 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--gold-subtle)" }}
            >
              <Sun
                className="h-8 w-8 text-[var(--gold-warm)]"
                strokeWidth={1.3}
                aria-hidden="true"
              />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-light">
              残しました。
            </h1>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              見学の印象は、このあとの比較で使われます。
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      {step !== "done" && (
        <footer
          className="sticky bottom-0 bg-background/85 backdrop-blur-md px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border/40"
        >
          <button
            type="button"
            onClick={next}
            disabled={isPending || (step === "mood" && mood === 0)}
            className="inline-flex h-12 w-full items-center justify-center rounded-[14px] bg-primary text-[14.5px] font-medium text-primary-foreground shadow-sm active:scale-[0.98] transition disabled:opacity-50"
          >
            {isPending
              ? "残しています…"
              : step === "concern"
                ? "印象を残す"
                : "次へ"}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="mt-2.5 w-full min-h-11 text-[12.5px] text-muted-foreground disabled:opacity-50"
          >
            あとでまとめる
          </button>
        </footer>
      )}
    </div>
  );
}
