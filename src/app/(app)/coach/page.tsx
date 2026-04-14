import { getAIInsights } from "@/server/actions/insights";
import { getCoachHistory } from "@/server/actions/coach";
import { AIInsightCard } from "@/components/ai/insight-card";
import { ChatBubble } from "@/components/coach/chat-bubble";
import { ChatBar } from "@/components/coach/chat-bar";
import { CoachQuickStart } from "@/components/coach/coach-quick-start";
import { EmptyState } from "@/components/ui/empty-state";
import { Search } from "lucide-react";

export default async function CoachPage() {
  const [insights, history] = await Promise.all([
    getAIInsights(),
    getCoachHistory(),
  ]);

  const hasContent = insights.length > 0 || history.length > 0;

  return (
    <div className="pb-20">
      <h2 className="mb-5 font-serif text-xl font-light tracking-wide">AIコーチ</h2>

      {!hasContent ? (
        <div className="space-y-8">
          {/* Zero-state rescue: quick-start prompts so users can talk to the coach
              even before adding any venue */}
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
      ) : (
        <div className="space-y-5">
          {/* Insight cards */}
          {insights.map((insight) => (
            <AIInsightCard
              key={insight.id}
              type={insight.type}
              title={insight.title}
              body={insight.body}
              actions={insight.actions}
            />
          ))}

          {/* Chat history */}
          {history.length > 0 && (
            <>
              <div className="my-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">これまでの会話</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                {history.map((msg) => (
                  <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <ChatBar />
    </div>
  );
}
