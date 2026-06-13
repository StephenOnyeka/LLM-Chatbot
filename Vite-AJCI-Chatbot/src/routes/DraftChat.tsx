import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Composer } from "../components/chat/Composer";
import { useAuth } from "../hooks/useAuth";
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
  const { data: user } = useAuth();

  const firstName = user?.name?.split(" ")[0] || "there";

  async function onSend(content: string, attachments?: Attachment[]) {
    if (creating) return;
    setCreating(true);
    try {
      const session = await api.sessions.create();
      qc.setQueryData<Message[]>(["messages", session.id], []);
      qc.setQueryData<Session[]>(["sessions"], (prev) => [
        session,
        ...(prev ?? []),
      ]);
      navigate(`/chat/${session.id}`, {
        state: { pending: content, pendingAttachments: attachments },
      });
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="gemini-landing flex flex-1 flex-col items-center justify-end px-4 pb-8 sm:justify-center sm:pb-0">
      {/* Greeting */}
      <h1 className="mb-8 text-center text-2xl font-normal text-white/90 sm:text-3xl md:text-4xl">
        What's the vibe, {firstName}?
      </h1>

      {/* Composer */}
      <div className="w-full max-w-2xl">
        <Composer onSend={onSend} disabled={creating} variant="landing" />
      </div>
    </div>
  );
}