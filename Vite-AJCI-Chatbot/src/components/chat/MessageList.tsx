import { useEffect, useRef } from "react";
import type { Message } from "../../lib/types";
import { MessageBubble } from "./MessageBubble";

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastSig = messages[messages.length - 1]?.content.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastSig]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={endRef} className="h-6" />
      </div>
    </div>
  );
}
