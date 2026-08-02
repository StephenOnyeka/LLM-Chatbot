import { AlertCircle, X } from "lucide-react";
import { Button } from "./Button";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
}

export function AlertModal({
  isOpen,
  onClose,
  title = "Notice",
  message,
  onConfirm,
  confirmText = "Confirm",
}: Props) {
  if (!isOpen) return null;

  const isConfirm = typeof onConfirm === "function";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              {title}
            </h3>
          </div>

          <div className="mt-4 text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">
            {message}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            {isConfirm ? (
              <>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    onConfirm?.();
                    onClose();
                  }}
                >
                  {confirmText}
                </Button>
              </>
            ) : (
              <Button onClick={onClose}>
                OK
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
