import { Bot, File, FileText, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn";
import type { Attachment, Message } from "../../lib/types";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  function renderAttachment(att: Attachment, i: number) {
    const isImage = att.mimeType.startsWith("image/");
    if (isImage) {
      return (
        <a key={i} href={att.url} target="_blank" rel="noreferrer" className="block w-full max-w-sm overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm transition hover:opacity-90">
          <img src={att.url} alt={att.name} className="h-auto w-full object-cover" />
        </a>
      );
    }

    return (
      <a key={i} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 shadow-sm transition hover:bg-[var(--color-surface-2)]/80">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg)]">
          {att.mimeType.includes("pdf") ? (
            <FileText className="h-5 w-5 text-red-400" />
          ) : (
            <File className="h-5 w-5 text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--color-text)]">{att.name}</div>
          <div className="text-xs text-[var(--color-text-muted)] uppercase">{att.mimeType.split("/")[1] || "FILE"}</div>
        </div>
      </a>
    );
  }

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

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex w-full flex-col gap-2">
            {message.attachments.map(renderAttachment)}
          </div>
        )}

        {/* Text Content */}
        {message.content && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm leading-6 text-[var(--color-text)]",
              isUser
                ? "rounded-tr-sm bg-[var(--color-accent)]/15"
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
        )}
      </div>
    </div>
  );
}
