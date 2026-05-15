import { Send } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TextArea } from "../ui/TextArea";

interface Props {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: Props) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="relative">
          <TextArea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            placeholder="Send a message…"
            className="pr-12"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)] text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
          Press Enter to send · Shift + Enter for newline
        </p>
      </div>
    </div>
  );
}
