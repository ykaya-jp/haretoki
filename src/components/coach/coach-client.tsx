"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { ChatBar } from "@/components/coach/chat-bar";
import { ChatHistory } from "@/components/coach/chat-history";
import { CoachQuickStart } from "@/components/coach/coach-quick-start";
import { SessionHistorySheet } from "@/components/coach/session-history-sheet";
import { AIInsightCard } from "@/components/ai/insight-card";
import { EmptyState } from "@/components/ui/empty-state";
import { NightQuestionCard } from "@/components/coach/night-question-card";
import { AgreementsSection } from "@/components/coach/agreements-section";
import type { SessionListItem, SessionDetail } from "@/server/actions/coach";
import type { AIInsight } from "@/server/actions/insights";
import type { NightQuestion } from "@/lib/night-questions";
import type { AgreementStatus } from "@/generated/prisma/client";

type AgreementItem = { id: string; text: string; status: AgreementStatus };

interface CoachClientProps {
  sessions: SessionListItem[];
  currentSession: SessionDetail | null;
  currentSessionId: string | undefined;
  insights: AIInsight[];
  nightQuestion?: NightQuestion | null;
  agreements: AgreementItem[];
}

type Tab = "chat" | "insights";

export function CoachClient({
  sessions,
  currentSession,
  currentSessionId,
  insights,
  nightQuestion,
  agreements,
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
        className="sticky top-0 z-20 -mx-6 border-b border-border/40 bg-background/75 px-6 py-3 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2">
          <SessionHistorySheet sessions={sessions} currentSessionId={sessionId} />

          <div className="min-w-0 flex-1 text-center">
            <h1
              className="truncate font-[family-name:var(--font-display)] text-[15px] font-extralight tracking-[0.02em] text-foreground"
              title={title}
            >
              {title}
            </h1>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            aria-label="新しい会話を始める"
            className="inline-flex h-11 items-center gap-1 rounded-full border px-3 text-[12.5px] font-medium transition active:scale-[0.98]"
            style={{
              background: "var(--gold-subtle)",
              borderColor: "color-mix(in oklab, var(--gold-warm) 55%, transparent)",
              color: "var(--gold-warm)",
              boxShadow:
                "0 1px 2px rgba(42,35,32,0.04), 0 6px 16px color-mix(in oklab, var(--gold-warm) 18%, transparent)",
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span className="tracking-wide">新しい会話</span>
          </button>
        </div>
      </div>

      <div className="mt-5">
        {/* Segmented Control: チャット / インサイト */}
        <div className="mb-5 flex rounded-xl bg-muted p-1">
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-light transition-all ${
              activeTab === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("chat")}
          >
            チャット
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-light transition-all ${
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
              <div className="space-y-8">
                {/* R-5 今夜の一問 — day-of-year × stage で 1 問だけ */}
                {nightQuestion && <NightQuestionCard question={nightQuestion} />}
                <AgreementsSection initialAgreements={agreements} />
                <CoachQuickStart />
                <div className="opacity-70">
                  <EmptyState
                    icon={Search}
                    title="式場を追加すると、さらに寄り添います"
                    description="気になる式場を追加すると、おふたりに合ったアドバイスや比較をお届けします。"
                    action={{ label: "式場を見てみる", href: "/explore" }}
                  />
                </div>
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  type={insight.type as any}
                  title={insight.title}
                  body={insight.body}
                  actions={insight.actions}
                />
              ))
            ) : (
              <EmptyState
                icon={Search}
                title="インサイトはまだありません"
                description="式場や見積もりを追加すると、AIがおふたりに合ったインサイトをお届けします。"
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
