import { useParams } from "react-router-dom";
import { Composer } from "../components/chat/Composer";
import { MessageList } from "../components/chat/MessageList";
import { Spinner } from "../components/ui/Spinner";
import { useMessages, useSendMessage } from "../hooks/useMessages";

export default function ChatThread() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const messages = useMessages(sessionId);
  const send = useSendMessage(sessionId);

  if (messages.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--color-text-muted)]">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  const list = messages.data ?? [];

  return (
    <>
      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-[var(--color-text-muted)]">
          <p className="text-sm">No messages yet — say hello to start the conversation.</p>
        </div>
      ) : (
        <MessageList messages={list} />
      )}
      <Composer onSend={(content) => send.mutate(content)} disabled={send.isPending} />
    </>
  );
}
