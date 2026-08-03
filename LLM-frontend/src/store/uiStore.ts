import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;

  alertConfig: { 
    isOpen: boolean; 
    title?: string; 
    message: string;
    onConfirm?: () => void;
    onCancel?: () => void;
    confirmText?: string;
  } | null;
  showAlert: (message: string, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string, confirmText?: string) => void;
  closeAlert: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Closed by default so the mobile drawer starts hidden. On md+ the sidebar is
  // `md:static md:translate-x-0`, so it shows regardless of this flag.
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),

  alertConfig: null,
  showAlert: (message, title) => set({ alertConfig: { isOpen: true, message, title } }),
  showConfirm: (message, onConfirm, title, confirmText) => 
    set({ alertConfig: { isOpen: true, message, onConfirm, title, confirmText } }),
  closeAlert: () => set((s) => {
    if (s.alertConfig?.onCancel) s.alertConfig.onCancel();
    return { alertConfig: s.alertConfig ? { ...s.alertConfig, isOpen: false } : null };
  }),
}));
