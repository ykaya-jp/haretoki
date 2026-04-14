"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ChatBar } from "@/components/coach/chat-bar";
import { ChatHistory } from "@/components/coach/chat-history";
import { CoachQuickStart } from "@/components/coach/coach-quick-start";
import { SessionHistorySheet } from "@/components/coach/session-history-sheet";
import { AIInsightCard } from "@/components/ai/insight-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { SessionListItem, SessionDetail } from "@/server/actions/coach";
import type { AIInsight } from "@/server/actions/insights";

interface CoachClientProps {
  sessions: SessionListItem[];
  currentSession: SessionDetail | null;
  currentSessionId: string | undefined;
  insights: AIInsight[];
}

type Tab = "chat" | "insights";

export function CoachClient({
  sessions,
  currentSession,
  currentSessionId,
  insights,
}: CoachClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(
    // If no session selected and there are insights, default to chat still
    currentSession ? "chat" : "chat",
  );
  const [sessionId, setSessionId] = useState<string | undefined>(currentSessionId);

  const handleNewSession = useCallback(
    (id: string) => {
      setSessionId(id);
      // Update URL without full navigation so SSR history updates on next refresh
      router.replace(`/coach?session=${id}`, { scroll: false });
    },
    [router],
  );

  const handleNewChat = () => {
    setSessionId(undefined);
    setActiveTab("chat");
    // Force a full refresh even when already on /coach so currentSession
    // prop resets to null and the QuickStart view comes back into view.
    router.replace("/coach", { scroll: true });
    router.refresh();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const messages = currentSession?.messages ?? [];
  const hasMessages = messages.length > 0;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SessionHistorySheet sessions={sessions} currentSessionId={sessionId} />
          <div>
            <h2 className="font-serif text-xl font-light tracking-wide">AIコーチ</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              迷ったら、AIに聞ける相談相手
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="新しい会話を始める"
          onClick={handleNewChat}
          className="h-11 w-11"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

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
                // AIInsight.type is a strict union matching InsightType
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

      <ChatBar sessionId={sessionId} onNewSession={handleNewSession} />
    </div>
  );
}
