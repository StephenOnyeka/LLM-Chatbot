import { MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl shadow-black/40">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">AJCI Chat</span>
        </div>
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-[var(--color-border)] pt-4 text-center text-sm text-[var(--color-text-muted)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
