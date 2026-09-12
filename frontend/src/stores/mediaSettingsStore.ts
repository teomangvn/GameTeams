import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Ses/goruntu aygit tercihleri ve mikrofon isleme ayarlari.
 *
 * Cihaza ozel oldugu icin sunucuda degil localStorage'da tutulur: ayni hesapla
 * baska bir bilgisayara giren kullanici oradaki aygitlari secmek ister.
 */
export interface MediaSettings {
  /** Bos string "sistem varsayilani" demek; deviceId kisitlamasi uygulanmaz. */
  microphoneId: string;
  speakerId: string;
  cameraId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

interface MediaSettingsState extends MediaSettings {
  /**
   * Kullanici basina uzak ses seviyesi (1 = %100, 2 = %200). Yalnizca bizim
   * duydugumuzu etkiler; karsi tarafa hicbir sey gitmez. Kayit yoksa %100.
   */
  userVolumes: Record<string, number>;
  set: (patch: Partial<MediaSettings>) => void;
  setUserVolume: (userId: string, volume: number) => void;
}

/** Ses seviyesi araligi: 0 sessiz, 2 iki kat yukseltme. */
export const MIN_USER_VOLUME = 0;
export const MAX_USER_VOLUME = 2;

const defaults: MediaSettings = {
  microphoneId: "",
  speakerId: "",
  cameraId: "",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

export const useMediaSettingsStore = create<MediaSettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      userVolumes: {},
      set: (patch) => set(patch),
      setUserVolume: (userId, volume) =>
        set((state) => {
          const clamped = Math.min(MAX_USER_VOLUME, Math.max(MIN_USER_VOLUME, volume));
          const next = { ...state.userVolumes };
          // Varsayilana donen kaydi tutmaya gerek yok; localStorage sisirmesin.
          if (clamped === 1) delete next[userId];
          else next[userId] = clamped;
          return { userVolumes: next };
        }),
    }),
    { name: "gameteams-media-settings" },
  ),
);

/** Kullanicinin kayitli ses seviyesi; kayit yoksa %100. */
export function useUserVolume(userId: string): number {
  return useMediaSettingsStore((s) => s.userVolumes[userId] ?? 1);
}

/** getUserMedia icin ses kisitlari. deviceId bos ise varsayilan aygit kullanilir. */
export function audioConstraints(settings: MediaSettings): MediaTrackConstraints {
  return {
    ...(settings.microphoneId ? { deviceId: { exact: settings.microphoneId } } : {}),
    noiseSuppression: settings.noiseSuppression,
    echoCancellation: settings.echoCancellation,
    autoGainControl: settings.autoGainControl,
  };
}

/** getUserMedia icin kamera kisitlari. */
export function videoConstraints(settings: MediaSettings): MediaTrackConstraints {
  return {
    ...(settings.cameraId ? { deviceId: { exact: settings.cameraId } } : {}),
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}
