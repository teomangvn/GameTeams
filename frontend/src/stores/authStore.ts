import { create } from "zustand";

import { authApi, type AuthUser } from "@/api/auth";
import { setAccessToken } from "@/api/client";

interface AuthState {
  user: AuthUser | null;
  /** Açılıştaki oturum geri yükleme tamamlandı mı? */
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Sayfa yenilendiğinde refresh cookie'sinden oturumu kurtarır. */
  restore: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,

  login: async (email, password) => {
    const { user } = await authApi.login({ email, password });
    set({ user });
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null });
  },

  restore: async () => {
    try {
      const { user } = await authApi.refresh();
      set({ user, initialized: true });
    } catch {
      // Cookie yok veya süresi dolmuş: anonim devam edilir.
      setAccessToken(null);
      set({ user: null, initialized: true });
    }
  },
}));
