import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatBubble({ role, content }: ChatBubbleProps) {
  return (
    <div className={cn("flex", role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          role === "user"
            ? "rounded-br bg-primary text-primary-foreground"
            : "rounded-bl bg-muted text-foreground"
        )}
      >
        {content}
      </div>
    </div>
  );
}
