import { create } from "zustand";

import { authApi, type AuthUser } from "@/api/auth";
import { setAccessToken } from "@/api/client";
import { disconnectStomp } from "@/lib/stompClient";

interface AuthState {
  user: AuthUser | null;
  /** Açılıştaki oturum geri yükleme tamamlandı mı? */
  initialized: boolean;
  /**
   * Oturum acildiysa null doner; cihaz dogrulamasi gerekiyorsa istek kimligi
   * ve maskelenmis adres doner.
   */
  login: (
    email: string,
    password: string,
  ) => Promise<{ challengeId: string; maskedEmail: string } | null>;
  /** Cihaz dogrulama kodunu tamamlayip oturumu acar. */
  verifyDevice: (challengeId: string, code: string, rememberDevice: boolean) => Promise<void>;
  logout: () => Promise<void>;
  /** Sayfa yenilendiğinde refresh cookie'sinden oturumu kurtarır. */
  restore: () => Promise<void>;
  /** Profil güncellendiğinde sunucudan dönen kullanıcıyı yerleştirir. */
  setUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,

  login: async (email, password) => {
    const result = await authApi.login({ email, password });

    if (result.status === "DEVICE_VERIFICATION_REQUIRED") {
      return {
        challengeId: result.challengeId ?? "",
        maskedEmail: result.maskedEmail ?? "",
      };
    }

    set({ user: result.auth?.user ?? null });
    return null;
  },

  verifyDevice: async (challengeId, code, rememberDevice) => {
    const { user } = await authApi.verifyDevice({ challengeId, code, rememberDevice });
    set({ user });
  },

  logout: async () => {
    // Once soketi kapat: token gecersizlestikten sonra yeniden baglanma
    // denemeleri bos yere hata uretir.
    disconnectStomp();
    await authApi.logout();
    set({ user: null });
  },

  setUser: (user) => set({ user }),

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
