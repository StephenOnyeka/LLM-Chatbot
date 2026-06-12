import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { cn } from "../../lib/cn";

interface Props {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}

// Six individual digit boxes that behave as a single OTP field: typing advances,
// Backspace retreats, arrows move, and pasting a full code fills every box. The
// canonical state is the parent's `value` string; boxes are derived from it.
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  error,
  autoFocus,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function focusBox(i: number) {
    refs.current[i]?.focus();
    refs.current[i]?.select();
  }

  function setDigit(i: number, digit: string) {
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, length);
    onChange(next);
  }

  function onBoxChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "");
    if (!digit) return;
    // If multiple chars arrive (autofill into one box), spread them forward.
    const chars = digit.split("");
    let next = value;
    let pos = i;
    for (const c of chars) {
      next = (next.slice(0, pos) + c + next.slice(pos + 1)).slice(0, length);
      pos = Math.min(pos + 1, length - 1);
    }
    onChange(next);
    focusBox(Math.min(i + chars.length, length - 1));
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        setDigit(i, "");
      } else if (i > 0) {
        setDigit(i - 1, "");
        focusBox(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      focusBox(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      focusBox(i + 1);
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusBox(Math.min(pasted.length, length - 1));
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={digit}
          onChange={(e) => onBoxChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 w-11 rounded-lg border bg-[var(--color-surface)] text-center text-lg font-semibold text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/60",
            error ? "border-[var(--color-danger)]" : "border-[var(--color-border)]",
          )}
        />
      ))}
    </div>
  );
}
