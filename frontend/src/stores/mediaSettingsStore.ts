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
  set: (patch: Partial<MediaSettings>) => void;
}

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
      set: (patch) => set(patch),
    }),
    { name: "gameteams-media-settings" },
  ),
);

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
