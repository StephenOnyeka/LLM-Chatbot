import { Crown, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../lib/api";
import { cn } from "../../lib/cn";
import { Spinner } from "./Spinner";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURES: { icon: string; label: string }[] = [
  { icon: "/email/cloudUpload.png", label: "Unlimited image and file uploads" },
  { icon: "/email/visibility.png", label: "Advanced vision analysis of your documents" },
  { icon: "/email/rocketLaunch.png", label: "Priority processing and faster responses" },
  { icon: "/email/rocketLaunch.png", label: "Early access to new experimental features" },
];

export function UpgradeModal({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleUpgrade() {
    try {
      setLoading(true);
      setError(null);
      const { url } = await api.stripe.createCheckoutSession();
      window.location.href = url;
    } catch (err) {
      console.error("Checkout failed:", err);
      setError("Failed to start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Graphic */}
        <div className="flex h-32 flex-col items-center justify-center bg-gradient-to-br from-[var(--color-accent)]/20 to-[var(--color-accent)]/5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-accent)] text-white shadow-lg">
            <Crown className="h-8 w-8" />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 pb-8 pt-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Upgrade to Pro
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Unlock the full power of AJCI Chatbot with a Pro membership.
          </p>

          <div className="mt-6 space-y-4 text-left">
            {FEATURES.map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <img src={icon} alt="" className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-3 font-semibold text-white shadow-lg transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--color-accent)]/25 active:scale-[0.98]",
                loading && "opacity-70 pointer-events-none"
              )}
            >
              {loading ? <Spinner className="h-5 w-5" /> : "Upgrade Now • $10/mo"}
            </button>
            <p className="mt-4 text-xs text-[var(--color-text-muted)]">
              Secure checkout provided by Stripe. Cancel anytime.
            </p>
            {error && (
              <p className="mt-2 text-sm text-[var(--color-danger)]">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
