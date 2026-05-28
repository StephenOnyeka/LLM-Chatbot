// import { Sparkles } from "lucide-react";
import { PiOpenAiLogoFill } from "react-icons/pi";
import { Button } from "../ui/Button";
import { useCreateSession } from "../../hooks/useSessions";

export default function EmptyState() {
  const create = useCreateSession();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
        {/* <Sparkles className="h-6 w-6" /> */}
        <PiOpenAiLogoFill className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Start a conversation</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">
        Pick a session from the sidebar or create a new one to begin chatting with the assistant.
      </p>
      <Button className="mt-6" onClick={() => create.mutate()} disabled={create.isPending}>
        New chat
      </Button>
    </div>
  );
}
