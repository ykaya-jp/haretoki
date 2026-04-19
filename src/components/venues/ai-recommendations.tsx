"use client";

import { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getExploreAIRecommendations } from "@/server/actions/onboarding";
import type {
  ExploreAIRecommendationsResult,
  ProjectConditionsSummary,
  VenueRecommendation,
} from "@/server/actions/onboarding-types";
import { createVenue } from "@/server/actions/venues";
import {
  Sparkles,
  Plus,
  Loader2,
  MapPin,
  RefreshCw,
  X,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

const CACHE_KEY = "ai-recs-v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const HIDE_KEY = "ai-recs-hidden-until";
const HIDE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedPayload {
  result: Extract<ExploreAIRecommendationsResult, { status: "ready" }>;
  venueCountWhenCached: number;
  conditionsHash: string;
  expiry: number;
}

function hashConditions(c: ProjectConditionsSummary): string {
  // Stable string — sort arrays so order doesn't change the hash.
  const sortedStyles = [...(c.styles ?? [])].sort();
  const sortedAreas = [...(c.areas ?? [])].sort();
  return JSON.stringify({
    s: sortedStyles,
    a: sortedAreas,
    g: c.guestCount ?? null,
    b: c.budgetMax ?? null,
  });
}

function readCache(): CachedPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (!parsed.expiry || Date.now() > parsed.expiry) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload: CachedPayload) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage quota / privacy mode — non-fatal.
  }
}

function clearCache() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* noop */
  }
}

function readHiddenUntil(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HIDE_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || ts <= Date.now()) return null;
    return ts;
  } catch {
    return null;
  }
}

function formatBudget(yen: number): string {
  return `${Math.round(yen / 10000)}万円以内`;
}

function formatRemaining(ms: number): string {
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `あと約${hours}時間`;
}

interface AIRecommendationsProps {
  initialVenueCount: number;
  initialConditions: ProjectConditionsSummary;
  /** Whether the server determined a Claude call is worthwhile. If false,
   *  the client renders a static "pre-AI" or "primed" state and never
   *  calls the server action — saves tokens and avoids flicker. */
  shouldRequest: boolean;
}

type ViewState =
  | { kind: "dismissed"; until: number }
  | { kind: "primed" } // 0 venues
  | { kind: "pre-ai"; venueCount: number; threshold: number } // 1..threshold-1
  | { kind: "loading" }
  | { kind: "ready"; data: Extract<ExploreAIRecommendationsResult, { status: "ready" }> }
  | { kind: "error" }
  | { kind: "unavailable" };

const THRESHOLD = 3;

export function AIRecommendations({
  initialVenueCount,
  initialConditions,
  shouldRequest,
}: AIRecommendationsProps) {
  const conditionsHash = useMemo(() => hashConditions(initialConditions), [initialConditions]);

  // All initial state derives synchronously from props + localStorage —
  // folding hide / cache lookups into the useState initializer avoids the
  // `set-state-in-effect` rule (and the momentary "loading → hidden"
  // flicker the previous effect-based version produced).
  const [hiddenUntil, setHiddenUntil] = useState<number | null>(() =>
    readHiddenUntil(),
  );
  const [view, setView] = useState<ViewState>(() => {
    const hidden = readHiddenUntil();
    if (hidden) return { kind: "dismissed", until: hidden };
    if (initialVenueCount === 0) return { kind: "primed" };
    if (initialVenueCount < THRESHOLD) {
      return { kind: "pre-ai", venueCount: initialVenueCount, threshold: THRESHOLD };
    }
    if (!shouldRequest) return { kind: "unavailable" };
    const cached = readCache();
    if (
      cached &&
      cached.venueCountWhenCached === initialVenueCount &&
      cached.conditionsHash === conditionsHash
    ) {
      return { kind: "ready", data: cached.result };
    }
    return { kind: "loading" };
  });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Countdown of `hiddenUntil - Date.now()`. Both the initial value and
  // subsequent updates flow through the same async path — requestAnimationFrame
  // for the first tick, setInterval for the minute cadence. This keeps render
  // pure (no `Date.now()` call) AND keeps useEffect free of synchronous
  // setState (rAF / interval callbacks are async).
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  useEffect(() => {
    const update = () =>
      setRemainingMs(hiddenUntil ? Math.max(0, hiddenUntil - Date.now()) : null);
    const raf = window.requestAnimationFrame(update);
    const interval = hiddenUntil ? window.setInterval(update, 60_000) : 0;
    return () => {
      window.cancelAnimationFrame(raf);
      if (interval) window.clearInterval(interval);
    };
  }, [hiddenUntil]);

  // fetchFresh is a pure-async refetch — callers decide whether to flip
  // view→loading beforehand (mount effect already seeds it; retry buttons
  // call setView({kind:"loading"}) right before invoking this).
  const fetchFresh = useCallback(async () => {
    try {
      const result = await getExploreAIRecommendations();
      if (result.status === "ready") {
        writeCache({
          result,
          venueCountWhenCached: result.venueCount,
          conditionsHash: hashConditions(result.conditions),
          expiry: Date.now() + CACHE_TTL_MS,
        });
        setView({ kind: "ready", data: result });
      } else if (result.status === "insufficient_data") {
        setView({
          kind: "pre-ai",
          venueCount: result.venueCount,
          threshold: result.threshold,
        });
      } else if (result.status === "unavailable") {
        setView({ kind: "unavailable" });
      } else {
        setView({ kind: "error" });
      }
    } catch {
      setView({ kind: "error" });
    }
  }, []);

  // On mount: hide / cache already applied in useState initializer. Only
  // fetch fresh if we landed on {loading}. Defer via setTimeout so the
  // setState inside fetchFresh runs asynchronously (sidesteps the
  // `set-state-in-effect` rule).
  useEffect(() => {
    if (view.kind !== "loading") return;
    const t = window.setTimeout(() => void fetchFresh(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    const until = Date.now() + HIDE_DURATION_MS;
    try {
      window.localStorage.setItem(HIDE_KEY, String(until));
    } catch {
      /* noop */
    }
    setHiddenUntil(until);
    setView({ kind: "dismissed", until });
    toast.success("24時間非表示にしました");
  };

  const handleRestore = () => {
    try {
      window.localStorage.removeItem(HIDE_KEY);
    } catch {
      /* noop */
    }
    setHiddenUntil(null);
    if (initialVenueCount === 0) {
      setView({ kind: "primed" });
    } else if (initialVenueCount < THRESHOLD) {
      setView({
        kind: "pre-ai",
        venueCount: initialVenueCount,
        threshold: THRESHOLD,
      });
    } else if (!shouldRequest) {
      setView({ kind: "unavailable" });
    } else {
      setView({ kind: "loading" });
      void fetchFresh();
    }
  };

  const handleAdd = (rec: VenueRecommendation) => {
    track("ai_recommendation_clicked", {
      venueName: rec.name,
      location: rec.location,
      hasEstimate: rec.estimatedPrice !== null && rec.estimatedPrice !== undefined,
    });
    setAddingId(rec.name);
    startTransition(async () => {
      try {
        const result = await createVenue({
          name: rec.name,
          location: rec.location,
          ceremonyStyles: rec.ceremonyStyles,
        });
        if (result.success) {
          toast.success(`${rec.name}を追加しました`);
          // venue count changed → invalidate cache so next visit refetches.
          clearCache();
          router.refresh();
        }
      } catch {
        toast.error("うまく追加できませんでした");
      } finally {
        setAddingId(null);
      }
    });
  };

  // Dismissed view — collapsed stub, renders outside the section to stay
  // minimal. We still surface a restore CTA so users aren't trapped.
  if (view.kind === "dismissed" && hiddenUntil) {
    return (
      <section
        aria-label="AIおすすめ式場"
        className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
      >
        <span className="text-xs text-muted-foreground">
          AI推薦は非表示中
          {remainingMs !== null ? ` — ${formatRemaining(remainingMs)} 後に再表示` : null}
        </span>
        <button
          type="button"
          onClick={handleRestore}
          className="inline-flex min-h-11 items-center gap-1 text-xs text-foreground underline underline-offset-4"
          aria-label="AI推薦を今すぐ表示する"
        >
          <RotateCcw className="h-3 w-3" />
          今すぐ戻す
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="AIおすすめ式場"
      aria-live="polite"
      className="space-y-4 rounded-2xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-5"
    >
      {/* Heading row — 2-tier: English eyebrow + 明朝 subheading */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          {/* Gold circle with Sparkles */}
          <div
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in oklab, var(--gold-warm) 14%, transparent)" }}
          >
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4 text-[var(--gold-warm)]"
              strokeWidth={1.5}
            />
          </div>
          <div className="space-y-0.5">
            {/* English eyebrow */}
            <p className="text-eyebrow text-[var(--gold-warm)]">
              AI Recommendations
            </p>
            {/* 明朝 subheading */}
            <h3 className="font-[family-name:var(--font-display)] text-[14px] font-light tracking-[0.01em] text-foreground">
              今日のおすすめ
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {view.kind === "ready" && (
            <button
              type="button"
              onClick={() => {
                clearCache();
                setView({ kind: "loading" });
                void fetchFresh();
              }}
              className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="おすすめを更新"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label="AI推薦を24時間非表示にする"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {view.kind === "primed" && <PrimedState />}
      {view.kind === "pre-ai" && (
        <PreAIState venueCount={view.venueCount} threshold={view.threshold} />
      )}
      {view.kind === "loading" && <LoadingState />}
      {view.kind === "unavailable" && <UnavailableState />}
      {view.kind === "error" && (
        <ErrorState
          onRetry={() => {
            setView({ kind: "loading" });
            void fetchFresh();
          }}
        />
      )}
      {view.kind === "ready" && (
        <ReadyState
          data={view.data}
          addingId={addingId}
          isPending={isPending}
          onAdd={handleAdd}
        />
      )}
    </section>
  );
}

// ---------- Sub-states ----------

function PrimedState() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-foreground">
        まず 1 件、気になる式場を迎えてみませんか。
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        候補が増えるほど、AI の推薦がふたりに寄ってきます。
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <a
          href="/explore?addVenue=1"
          className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground"
        >
          URLから追加
        </a>
        <a
          href="/explore"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-muted-foreground"
        >
          式場を検索
        </a>
      </div>
    </div>
  );
}

function PreAIState({ venueCount, threshold }: { venueCount: number; threshold: number }) {
  const remaining = threshold - venueCount;
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-foreground">
        追加を進めましょう — あと{remaining}件でAI推薦が動き始めます。
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        迎えた式場の傾向から、相性の良い候補をお届けします。
      </p>
      {/* Progress bar — subtle visual on the unlock */}
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--gold-warm)]/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={venueCount}
        aria-label={`${threshold}件中${venueCount}件登録済み`}
      >
        <div
          className="h-full bg-[var(--gold-warm)] transition-[width] motion-reduce:transition-none"
          style={{ width: `${(venueCount / threshold) * 100}%` }}
        />
      </div>
      <a
        href="/explore?addVenue=1"
        className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground"
      >
        URLから式場を追加
      </a>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-foreground">
        おふたりの式場リストから、相性の良い候補を探しています
      </p>
      <div className="space-y-2 pt-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-xl bg-card/60 motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function UnavailableState() {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-foreground">
        今日のおすすめは準備中です。
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        候補を増やすと、ふたりに合う式場の精度が上がっていきます。
      </p>
      <a
        href="/candidates?view=recent"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-[var(--gold-warm)] underline underline-offset-4"
      >
        先日ご覧になった式場をどうぞ →
      </a>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        おすすめの取得に失敗しました。しばらくしてからお試しください。
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onRetry}
        className="gap-1"
      >
        <RefreshCw className="h-3 w-3" />
        再試行
      </Button>
    </div>
  );
}

function ReadyState({
  data,
  addingId,
  isPending,
  onAdd,
}: {
  data: Extract<ExploreAIRecommendationsResult, { status: "ready" }>;
  addingId: string | null;
  isPending: boolean;
  onAdd: (rec: VenueRecommendation) => void;
}) {
  const conditionChips = useMemo(() => {
    const chips: string[] = [];
    if (data.conditions.areas?.length) chips.push(data.conditions.areas.join("・"));
    if (data.conditions.guestCount) chips.push(`${data.conditions.guestCount}名前後`);
    if (data.conditions.budgetMax) chips.push(formatBudget(data.conditions.budgetMax));
    if (data.conditions.styles?.length) chips.push(data.conditions.styles.join("・"));
    chips.push(`${data.venueCount} 件を参考`);
    return chips;
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Rationale bar — what inputs the AI used */}
      <div className="flex flex-wrap gap-1.5">
        {conditionChips.map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-card/70 px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {chip}
          </span>
        ))}
      </div>

      {data.advice && (
        <p className="text-xs leading-relaxed text-muted-foreground">{data.advice}</p>
      )}

      <div className="space-y-2">
        {data.recommendations.map((rec) => (
          <RecommendationCard
            key={rec.name}
            rec={rec}
            adding={isPending && addingId === rec.name}
            onAdd={() => onAdd(rec)}
          />
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({
  rec,
  adding,
  onAdd,
}: {
  rec: VenueRecommendation;
  adding: boolean;
  onAdd: () => void;
}) {
  const rationaleChips: string[] = [];
  if (rec.rationale?.area_match) rationaleChips.push("エリア一致");
  if (rec.rationale?.budget_match) rationaleChips.push("予算内");
  if (rec.rationale?.style_match) rationaleChips.push("スタイル一致");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <h4 className="font-[family-name:var(--font-display)] text-[17px] font-light tracking-[0.01em]">{rec.name}</h4>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {rec.location}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{rec.reason}</p>
          {rec.estimatedPrice !== null && rec.estimatedPrice !== undefined && (
            <p className="tabular-nums text-xs text-[var(--gold-warm)]">
              ¥{(rec.estimatedPrice / 10000).toFixed(0)}万〜
            </p>
          )}
          {(rationaleChips.length > 0 || rec.strengths.length > 0) && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {rationaleChips.map((s) => (
                <span
                  key={`r-${s}`}
                  className="rounded-full bg-[var(--gold-warm)]/15 px-2 py-0.5 text-[10px] text-[var(--gold-warm)]"
                >
                  根拠: {s}
                </span>
              ))}
              {rec.strengths.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={adding}
          className="shrink-0 gap-1"
          aria-label={`${rec.name}を追加`}
        >
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          追加
        </Button>
      </div>
    </div>
  );
}
