import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "ghost" | "icon" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-4 py-2 text-sm",
  ghost:
    "bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text)] px-3 py-2 text-sm",
  icon: "bg-transparent hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] h-9 w-9",
  danger:
    "bg-transparent hover:bg-[var(--color-danger)]/10 text-[var(--color-danger)] px-3 py-2 text-sm",
};

export function Button({ variant = "primary", className, ...rest }: Props) {
  return <button className={cn(base, variants[variant], className)} {...rest} />;
}
