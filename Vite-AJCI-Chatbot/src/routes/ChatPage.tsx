import { useQueryClient } from "@tanstack/react-query";
import { Menu, MessageSquareText } from "lucide-react";
import { useEffect } from "react";
import { Outlet, useSearchParams } from "react-router-dom";
import { Sidebar } from "../components/chat/Sidebar";
import { api } from "../lib/api";
import { useUIStore } from "../store/uiStore";

export default function ChatPage() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebar = useUIStore((s) => s.setSidebar);
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  useEffect(() => {
    const success = searchParams.get("payment_success");
    const sessionId = searchParams.get("session_id");

    if (success === "true" && sessionId) {
      api.stripe.verifySession(sessionId)
        .then(() => {
          alert("Payment successful! You are now a Pro member. You can upload images and files!");
          qc.invalidateQueries({ queryKey: ["auth", "me"] });
        })
        .catch((err) => {
          console.error("Failed to verify session:", err);
        })
        .finally(() => {
          // Clean up the URL
          searchParams.delete("payment_success");
          searchParams.delete("session_id");
          setSearchParams(searchParams, { replace: true });
        });
    }
  }, [searchParams, setSearchParams, qc]);

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
