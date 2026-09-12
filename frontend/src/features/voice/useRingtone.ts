import { useEffect } from "react";

import { useMediaSettingsStore } from "@/stores/mediaSettingsStore";

/** setSinkId henuz her tarayicida yok ve AudioContext tipinde tanimli degil. */
type AudioContextWithSink = AudioContext & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

/**
 * Arama tonlari. Ses dosyasi yerine sentezlenir: ek varlik yok, secili
 * hoparlore yonlendirilebilir.
 *
 * - incoming: gelen arama; iki kisa yuksek ton, belirgin.
 * - outgoing: arayan tarafin duydugu "caliyor" sesi; tek, alcak ve yumusak.
 */
export function useRingtone(kind: "incoming" | "outgoing" | null) {
  const speakerId = useMediaSettingsStore((s) => s.speakerId);

  useEffect(() => {
    if (!kind) return;

    let context: AudioContextWithSink;
    try {
      context = new AudioContext() as AudioContextWithSink;
    } catch {
      return;
    }
    if (speakerId && context.setSinkId) void context.setSinkId(speakerId).catch(() => undefined);
    // Otomatik oynatma kilidi acilmamissa ton calmaz; arama penceresi yine gorunur.
    void context.resume().catch(() => undefined);

    const beep = (at: number, frequency: number, length: number, volume: number) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      // Yumusak baslayip biten zarf: ani basla/dur tik sesi uretir.
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + 0.02);
      gain.gain.setValueAtTime(volume, at + length - 0.04);
      gain.gain.linearRampToValueAtTime(0, at + length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + length + 0.01);
    };

    const pattern = () => {
      const now = context.currentTime + 0.05;
      if (kind === "incoming") {
        beep(now, 880, 0.18, 0.16);
        beep(now + 0.24, 1175, 0.18, 0.16);
      } else {
        beep(now, 440, 0.9, 0.07);
      }
    };

    pattern();
    const interval = setInterval(pattern, kind === "incoming" ? 1_600 : 3_000);

    return () => {
      clearInterval(interval);
      void context.close().catch(() => undefined);
    };
  }, [kind, speakerId]);
}
