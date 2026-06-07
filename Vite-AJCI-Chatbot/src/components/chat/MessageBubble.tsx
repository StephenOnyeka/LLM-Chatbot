import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn";
import type { Message } from "../../lib/types";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-4 sm:px-6",
        // User messages sit on the right, the assistant on the left.
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser
            ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
            : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("flex min-w-0 max-w-[90%] flex-col", isUser ? "items-end" : "items-start")}>
        <div className="mb-1 text-xs font-medium text-[var(--color-text-muted)]">
          {isUser ? "You" : "Assistant"}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-6 text-[var(--color-text)]",
            isUser
              ? "rounded-tr-sm bg-[var(--color-accent)]/15"
              // : "rounded-tl-sm bg-[var(--color-surface)]/60",
              : "rounded-tl-sm bg-[var(--color-surface)]/0",
          )}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {message.pending && (
            <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-[var(--color-text-muted)]" />
          )}
        </div>
      </div>
    </div>
  );
}
