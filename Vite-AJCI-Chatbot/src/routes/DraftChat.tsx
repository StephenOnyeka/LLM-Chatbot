import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PiOpenAiLogoFill } from "react-icons/pi";
import { Composer } from "../components/chat/Composer";
import { api } from "../lib/api";
import type { Attachment, Message, Session } from "../lib/types";

// The /chat landing page is a *draft*: it shows the composer but creates no
// backend session. A conversation row is only created when the user sends their
// first message — at which point the backend auto-titles it from that message.
// This is why empty "New chat" rows never accumulate in history.
export default function DraftChat() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  async function onSend(content: string, attachments?: Attachment[]) {
    if (creating) return;
    setCreating(true);
    try {
      const session = await api.sessions.create();
      // Seed caches so the new thread renders instantly without a refetch race:
      // an empty message list, and the session at the top of history.
      qc.setQueryData<Message[]>(["messages", session.id], []);
      qc.setQueryData<Session[]>(["sessions"], (prev) => [session, ...(prev ?? [])]);
      // Hand the first message to the thread, which sends it on mount.
      navigate(`/chat/${session.id}`, { state: { pending: content, pendingAttachments: attachments } });
    } catch {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
          <PiOpenAiLogoFill className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Start a conversation</h2>
        <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">
          Type a message below to begin chatting with the assistant.
        </p>
      </div>
      <Composer onSend={onSend} disabled={creating} />
    </>
  );
}
