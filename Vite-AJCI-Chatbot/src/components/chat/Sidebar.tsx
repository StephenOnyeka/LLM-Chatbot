import { LogOut, MessageSquareText, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { useAuth, useLogout } from "../../hooks/useAuth";
import { useCreateSession, useDeleteSession, useSessions } from "../../hooks/useSessions";
import { useUIStore } from "../../store/uiStore";
import { cn } from "../../lib/cn";
import { SessionItem } from "./SessionItem";

export function Sidebar() {
  const { data: user } = useAuth();
  const sessions = useSessions();
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();
  const logout = useLogout();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebar = useUIStore((s) => s.setSidebar);

  return (
    <aside
      className={cn(
        // Mobile: fixed slide-in drawer driven by `sidebarOpen`.
        "fixed inset-y-0 left-0 z-40 flex h-full w-72 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        // md+: revert to a static in-flow column, always visible.
        "md:static md:translate-x-0",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
          <MessageSquareText className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight">AJCI Chat</span>
      </div>

      <div className="px-3">
        <Button
          variant="primary"
          className="w-full"
          onClick={() => {
            createSession.mutate();
            setSidebar(false);
          }}
          disabled={createSession.isPending}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-2">
        <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          History
        </div>
        {sessions.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : sessions.data && sessions.data.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {sessions.data.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                onDelete={(id) => deleteSession.mutate(id)}
              />
            ))}
          </div>
        ) : (
          <p className="px-3 py-4 text-xs text-[var(--color-text-muted)]">
            No conversations yet. Start a new chat to begin.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-sm font-medium">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user?.name}</div>
            <div className="truncate text-xs text-[var(--color-text-muted)]">{user?.email}</div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            onClick={() => logout.mutate()}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
