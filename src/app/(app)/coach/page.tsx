import { getAIInsights } from "@/server/actions/insights";
import { getCoachHistory } from "@/server/actions/coach";
import { AIInsightCard } from "@/components/ai/insight-card";
import { ChatBubble } from "@/components/coach/chat-bubble";
import { ChatBar } from "@/components/coach/chat-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageSquare } from "lucide-react";

export default async function CoachPage() {
  const [insights, history] = await Promise.all([
    getAIInsights(),
    getCoachHistory(),
  ]);

  const hasContent = insights.length > 0 || history.length > 0;

  return (
    <div className="pb-[72px]">
      <h2 className="mb-4">AIコーチ</h2>

      {!hasContent ? (
        <EmptyState
          icon={MessageSquare}
          title="式場を追加すると、AIコーチがアドバイスを始めます"
          description="気になる式場を登録してみましょう"
          action={{ label: "式場を追加する", href: "/explore" }}
        />
      ) : (
        <div className="space-y-4">
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
              <hr className="border-border" />
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
