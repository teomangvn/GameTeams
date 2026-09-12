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
  noiseSuppression: NoiseSuppressionMode;
  echoCancellation: boolean;
  autoGainControl: boolean;
  /**
   * Ses esigi: seviye esigin altindayken mikrofon tamamen susar. Konusma
   * arasindaki klavye tiklamalari ve nefes sesleri boylece hic gitmez.
   */
  voiceGate: boolean;
  /** Esik, dBFS cinsinden (-80 cok hassas, -20 yalnizca yuksek ses). */
  voiceGateThreshold: number;
}

/**
 * Gurultu engelleme modu.
 *
 * - standard: tarayicinin yerlesik engelleyicisi. Fan ve ugultu gibi sabit
 *   gurultuyu azaltir; klavye, kopek, trafik gibi ani seslerde zayif kalir.
 * - enhanced: RNNoise sinir agi, cihazda calisir. Ani sesleri de bastirir.
 */
export type NoiseSuppressionMode = "off" | "standard" | "enhanced";

export const VOICE_GATE_MIN_DB = -80;
export const VOICE_GATE_MAX_DB = -20;

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
  noiseSuppression: "enhanced",
  echoCancellation: true,
  autoGainControl: true,
  voiceGate: false,
  voiceGateThreshold: -50,
};

/**
 * Kayitli ayarlari guncel bicime tasir.
 *
 * v0'da noiseSuppression boolean'di. Acik olanlar gelismis moda gecer: eski
 * ayar zaten "gurultuyu engelle" istegiydi ve standart mod bunu karsilamadigi
 * icin sikayet ediliyordu.
 */
export function migrateMediaSettings(persisted: unknown, version: number): Record<string, unknown> {
  const state = { ...((persisted ?? {}) as Record<string, unknown>) };
  if (version < 1 && typeof state.noiseSuppression === "boolean") {
    state.noiseSuppression = state.noiseSuppression ? "enhanced" : "off";
  }
  return state;
}

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
    {
      name: "gameteams-media-settings",
      version: 1,
      migrate: (persisted, version) =>
        migrateMediaSettings(persisted, version) as unknown as MediaSettingsState,
    },
  ),
);

/** Kullanicinin kayitli ses seviyesi; kayit yoksa %100. */
export function useUserVolume(userId: string): number {
  return useMediaSettingsStore((s) => s.userVolumes[userId] ?? 1);
}

/**
 * getUserMedia icin ses kisitlari. deviceId bos ise varsayilan aygit kullanilir.
 *
 * Gelismis modda tarayicinin engelleyicisi kapatilir: iki engelleyici ust
 * uste binince ses metalik ve kesik kesik gelir, RNNoise zaten daha iyisini
 * yapiyor. RNNoise 48 kHz mono bekledigi icin yakalama da oyle istenir.
 */
export function audioConstraints(
  settings: Pick<MediaSettings, "microphoneId" | "noiseSuppression" | "echoCancellation" | "autoGainControl">,
): MediaTrackConstraints {
  return {
    ...(settings.microphoneId ? { deviceId: { exact: settings.microphoneId } } : {}),
    noiseSuppression: settings.noiseSuppression === "standard",
    echoCancellation: settings.echoCancellation,
    autoGainControl: settings.autoGainControl,
    channelCount: { ideal: 1 },
    sampleRate: { ideal: 48_000 },
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
