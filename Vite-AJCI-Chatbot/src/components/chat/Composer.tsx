import { Plus, Send, X, File, FileText } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../lib/api";
import type { Attachment } from "../../lib/types";
import { Spinner } from "../ui/Spinner";
import { TextArea } from "../ui/TextArea";
import { UpgradeModal } from "../ui/UpgradeModal";

interface Props {
  onSend: (content: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
}

export function Composer({ onSend, disabled }: Props) {
  const { data: user } = useAuth();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
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
      // Reset input so the same file can be selected again
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
          <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
        </div>
      );
    }
    if (att.mimeType.includes("pdf")) return <FileText className="h-5 w-5 text-red-400" />;
    return <File className="h-5 w-5 text-gray-400" />;
  }

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-4">
      <div className="mx-auto max-w-3xl">
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

        <div className="relative flex items-end gap-2">
          {/* Plus icon / File upload button */}
          <button
            type="button"
            onClick={handlePlusClick}
            disabled={disabled || uploading || attachments.length >= 5}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Attach file"
          >
            <Plus className="h-5 w-5" />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />

          <div className="relative flex-1">
            <TextArea
              ref={ref}
              rows={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKey}
              placeholder="Send a message…"
              className="pr-12"
              disabled={disabled || uploading}
            />
            <button
              type="button"
              onClick={submit}
              disabled={disabled || !hasContent || uploading}
              className="absolute right-2 bottom-2 flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)] text-white transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send message"
            >
              {uploading ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
          Press Enter to send · Shift + Enter for newline
        </p>
      </div>

      <UpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
}
