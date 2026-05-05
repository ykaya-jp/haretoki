"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { History, Plus, Search } from "lucide-react";
import { ChatBar } from "@/components/coach/chat-bar";
import { ChatHistory } from "@/components/coach/chat-history";
import { CoachQuickStart } from "@/components/coach/coach-quick-start";
import { ProactiveSuggestions } from "@/components/coach/proactive-suggestions";
import { AIInsightCard } from "@/components/ai/insight-card";
import { EmptyState } from "@/components/ui/empty-state";
import { NightQuestionCard } from "@/components/coach/night-question-card";

/**
 * Phase 4 launch readiness — `SessionHistorySheet` is heavy
 * (`@tanstack/react-virtual` + radix Sheet + 376 lines of list
 * UI) and only opens when the operator taps the History icon.
 * Lazy-loading via next/dynamic strips it from the initial chunk
 * and replaces the trigger with a same-shape placeholder button
 * during hydration. See docs/harness/bundle-baseline-2.md § 3 / E1.
 */
const SessionHistorySheet = dynamic(
  () =>
    import("@/components/coach/session-history-sheet").then(
      (m) => m.SessionHistorySheet,
    ),
  {
    ssr: false,
    loading: () => (
      <button
        type="button"
        aria-label="チャット履歴を読み込み中"
        disabled
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
      >
        <History className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </button>
    ),
  },
);
import type { SessionListItem, SessionDetail } from "@/server/actions/coach";
import type { AIInsight } from "@/server/actions/insights";
import type { ProactiveSuggestion } from "@/server/actions/coach-suggestions";
import type { NightQuestion } from "@/lib/night-questions";
import type { AgreementStatus } from "@/generated/prisma/client";

type AgreementItem = { id: string; text: string; status: AgreementStatus };

interface CoachClientProps {
  sessions: SessionListItem[];
  currentSession: SessionDetail | null;
  currentSessionId: string | undefined;
  insights: AIInsight[];
  nightQuestion?: NightQuestion | null;
  proactiveSuggestions?: ProactiveSuggestion[];
  agreements: AgreementItem[];
}

type Tab = "chat" | "insights";

export function CoachClient({
  sessions,
  currentSession,
  currentSessionId,
  insights,
  nightQuestion,
  proactiveSuggestions = [],
}: CoachClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [sessionId, setSessionId] = useState<string | undefined>(currentSessionId);

  const handleNewSession = useCallback(
    (id: string) => {
      setSessionId(id);
      router.replace(`/coach?session=${id}`, { scroll: false });
    },
    [router],
  );

  const handleNewChat = () => {
    setSessionId(undefined);
    setActiveTab("chat");
    router.replace("/coach", { scroll: true });
    router.refresh();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const messages = currentSession?.messages ?? [];
  const hasMessages = messages.length > 0;
  const title = currentSession?.session.title ?? "AI コーチ";

  return (
    <div className="pb-20">
      {/* Sticky header: history chip + title + new-chat chip */}
      <div
        // W21-4: pt combines `py-3` (12px) with iOS safe-area-inset-top
        // so the title row sits below the notch on standalone-PWA
        // viewports without losing the backdrop-blur band.
        className="sticky top-0 z-20 -mx-5 border-b border-border/40 bg-background/75 px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl sm:-mx-8 sm:px-8"
      >
        <div className="flex items-center gap-2">
          <SessionHistorySheet sessions={sessions} currentSessionId={sessionId} />

          <div className="min-w-0 flex-1 text-center">
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-eyebrow text-muted-foreground">
              <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
              <span aria-hidden="true" className="opacity-30">·</span>
              <span>Coach</span>
            </p>
            <h1
              className="truncate font-[family-name:var(--font-display)] text-[15px] font-light tracking-[0.02em] leading-[1.35] text-foreground"
              title={title}
            >
              {title}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            aria-label="新しい会話を始める"
            title="新しい会話"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition active:scale-[0.95]"
            style={{
              background: "var(--gold-subtle)",
              borderColor: "color-mix(in oklab, var(--gold-warm) 55%, transparent)",
              color: "var(--gold-warm)",
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.04), 0 6px 16px color-mix(in oklab, var(--gold-warm) 18%, transparent)",
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-5">
        {/* Segmented Control: チャット / インサイト */}
        <div className="mb-5 flex rounded-xl bg-muted p-1">
          <button
            className={`flex-1 min-h-[44px] rounded-lg py-3 text-sm font-light transition-all active:scale-[0.97] ${
              activeTab === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("chat")}
          >
            チャット
          </button>
          <button
            className={`flex-1 min-h-[44px] rounded-lg py-3 text-sm font-light transition-all active:scale-[0.97] ${
              activeTab === "insights"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("insights")}
          >
            インサイト
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "chat" && (
          <div className="space-y-4">
            {hasMessages ? (
              <ChatHistory messages={messages} />
            ) : (
              <div className="space-y-6">
                {nightQuestion && <NightQuestionCard question={nightQuestion} />}
                {proactiveSuggestions.length > 0 && (
                  <ProactiveSuggestions suggestions={proactiveSuggestions} />
                )}
                <CoachQuickStart />
              </div>
            )}
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-5">
            {insights.length > 0 ? (
              insights.map((insight) => (
                <AIInsightCard
                  key={insight.id}
                  type={insight.type as "estimate" | "partner" | "visit" | "comparison" | "reminder"}
                  title={insight.title}
                  body={insight.body}
                  actions={insight.actions}
                />
              ))
            ) : (
              <EmptyState
                icon={Search}
                title="気づきは、これから"
                description="式場や見積もりが集まると、おふたりの選び方に合わせた小さな気づきが届きはじめます。"
                action={{ label: "式場を見てみる", href: "/explore" }}
              />
            )}
          </div>
        )}
      </div>

      <ChatBar sessionId={sessionId} onNewSession={handleNewSession} />
    </div>
  );
}
