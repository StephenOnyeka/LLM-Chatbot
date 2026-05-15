import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/chat/Sidebar";

export default function ChatPage() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex h-full flex-1 flex-col bg-[var(--color-bg)]">
        <Outlet />
      </main>
    </div>
  );
}
