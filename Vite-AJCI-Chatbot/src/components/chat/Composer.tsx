import { Plus, X, File, FileText } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import type { Attachment } from "../../lib/types";
import { Spinner } from "../ui/Spinner";
import { UpgradeModal } from "../ui/UpgradeModal";
import { cn } from "../../lib/cn";

interface Props {
  onSend: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
  /** When "landing" the composer renders with Gemini-style pill shape for the /chat home */
  variant?: "landing" | "thread";
}

export function Composer({ onSend, disabled, variant = "thread" }: Props) {
  const { data: user } = useAuth();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled || uploading) return;
    onSend(trimmed, attachments);
    setValue("");
    setAttachments([]);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function handlePlusClick() {
    if (!user?.isPro) {
      setShowUpgrade(true);
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newAttachments = [...attachments];
      for (const file of Array.from(files)) {
        if (newAttachments.length >= 5) {
          alert("Maximum of 5 attachments allowed.");
          break;
        }
        const uploaded = await api.upload(file);
        newAttachments.push(uploaded);
      }
      setAttachments(newAttachments);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function renderAttachmentIcon(att: Attachment) {
    if (att.mimeType.startsWith("image/")) {
      return (
        <div className="h-full w-full overflow-hidden">
          <img
            src={att.url}
            alt={att.name}
            className="h-full w-full object-cover"
          />
        </div>
      );
    }
    if (att.mimeType.includes("pdf"))
      return <FileText className="h-5 w-5 text-red-400" />;
    return <File className="h-5 w-5 text-gray-400" />;
  }

  const hasContent = value.trim().length > 0 || attachments.length > 0;
  const isLanding = variant === "landing";

  return (
    <div
      className={cn(
        isLanding
          ? "w-full"
          : "border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4",
      )}
    >
      <div className={cn("mx-auto w-full", isLanding ? "" : "max-w-3xl")}>
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-3">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="relative flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-sm"
                title={att.name}
              >
                {renderAttachmentIcon(att)}
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] ring-1 ring-[var(--color-border)] hover:bg-[var(--color-danger)] hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploading && (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-sm">
                <Spinner className="h-5 w-5" />
              </div>
            )}
          </div>
        )}

        {/* Gemini-style pill input */}
        <div
          className={cn(
            "flex flex-col",
            isLanding
              ? "rounded-3xl border border-white/10 bg-[#1e2230] shadow-lg"
              : "rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-2)]",
          )}
        >
          {/* Text area — takes full width, sits on top */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask AJCI…"
            disabled={disabled || uploading}
            className={cn(
              "min-h-[48px] w-full resize-none bg-transparent px-5 pb-1 pt-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none",
              !hasContent && "text-center sm:text-left",
            )}
          />

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />

          {/* Bottom bar: Plus on the left, Send on the right */}
          <div className="flex items-center justify-between px-2 py-2">
            {/* Plus / Attach button */}
            <button
              type="button"
              onClick={handlePlusClick}
              disabled={disabled || uploading || attachments.length >= 5}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-white/5 hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Attach file"
            >
              <Plus className="h-5 w-5" />
            </button>

            {/* Send button — visible only when there is content */}
            {hasContent ? (
              <button
                type="button"
                onClick={submit}
                disabled={disabled || uploading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white transition hover:bg-[#3b78e0] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {uploading ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 19V5m0 0l-7 7m7-7l7 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ) : (
               <button
                type="button"
                onClick={submit}
                disabled={disabled || uploading}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-600 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                {uploading ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 19V5m0 0l-7 7m7-7l7 7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Helper text — only in thread mode */}
        {!isLanding && (
          <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
            Press Enter to send · Shift + Enter for newline
          </p>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  );
}
