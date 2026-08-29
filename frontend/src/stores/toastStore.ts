import { create } from "zustand";

export type ToastTone = "error" | "success" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const AUTO_DISMISS_MS = 5000;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (tone, message) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }));
    // Hatalar da otomatik kapanir; kullanici her birini elle kapatmak
    // zorunda kalmasin.
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Bilesen disindan da cagrilabilsin diye kisayollar. */
export const toast = {
  error: (message: string) => useToastStore.getState().push("error", message),
  success: (message: string) => useToastStore.getState().push("success", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};
