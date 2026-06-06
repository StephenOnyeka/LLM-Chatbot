import { Menu, MessageSquareText } from "lucide-react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/chat/Sidebar";
import { useUIStore } from "../store/uiStore";

export default function ChatPage() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebar = useUIStore((s) => s.setSidebar);

  return (
    <div className="flex h-full">
      {/* Dimming overlay behind the mobile drawer; tap to dismiss. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebar(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar />

      <main className="flex h-full flex-1 flex-col bg-[var(--color-bg)]">
        {/* Mobile-only top bar with the drawer toggle. */}
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-3 md:hidden">
          <button
            type="button"
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)]">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight">AJCI Chat</span>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
