import { Trash2 } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import type { Session } from "../../lib/types";

interface Props {
  session: Session;
  onDelete: (id: string) => void;
}

export function SessionItem({ session, onDelete }: Props) {
  return (
    <NavLink
      to={`/chat/${session.id}`}
      className={({ isActive }) =>
        cn(
          "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
          isActive
            ? "bg-[var(--color-surface-2)] text-[var(--color-text)]"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]/60 hover:text-[var(--color-text)]",
        )
      }
    >
      <span className="flex-1 truncate">{session.title}</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(session.id);
        }}
        className="opacity-0 transition group-hover:opacity-100 hover:text-[var(--color-danger)]"
        aria-label={`Delete ${session.title}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </NavLink>
  );
}
