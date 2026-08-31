import { useEffect, useRef, useState } from "react";

/** Bu seviyenin uzerindeki RMS "konusuyor" sayilir. */
const SPEAKING_THRESHOLD = 0.03;
/** Sessizlige dusunce cerceve hemen sonmesin; kelimeler arasi bosluklar titretirdi. */
const RELEASE_MS = 320;

/**
 * Verilen ses akislarindan hangilerinde konusma oldugunu tespit eder.
 *
 * Her akis icin bir AnalyserNode kurulur ve zaman alaninda RMS hesaplanir.
 * Sunucuya ek bir sinyal tasimaya gerek yok: ses zaten karsi tarafa geliyor,
 * seviyeyi yerelde olcmek hem daha hizli hem de bant genisligi harcamiyor.
 *
 * Not: mikrofon kapatildiginda track devre disi kalir ve analyser sessizlik
 * gorur, dolayisiyla susturulmus kullanici kendiliginden "konusmuyor" olur.
 */
export function useSpeakingDetection(streams: Record<string, MediaStream>): Set<string> {
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());

  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | undefined>(undefined);
  const lastLoudRef = useRef<Map<string, number>>(new Map());

  // Analyser'lari yalnizca gercekten degistiklerinde yeniden kur. Anahtara
  // MediaStream.id de giriyor: yeniden pazarlikta ayni kullanici icin yeni bir
  // akis gelebilir ve eski akisi dinlemeye devam etmek sessizlik gosterirdi.
  const key = Object.entries(streams)
    .map(([id, stream]) => `${id}:${stream.id}`)
    .sort()
    .join("|");

  useEffect(() => {
    const entries = Object.entries(streams).filter(
      ([, stream]) => stream.getAudioTracks().length > 0,
    );

    if (entries.length === 0) {
      setSpeaking(new Set());
      return;
    }

    let context: AudioContext;
    try {
      context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
    } catch {
      // AudioContext yoksa gosterge calismaz; ses akisi etkilenmez.
      return;
    }

    const nodes = entries.map(([id, stream]) => {
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      // Yumusatma titremeyi azaltir ama gecikme de ekler; orta bir deger.
      analyser.smoothingTimeConstant = 0.4;

      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      return { id, analyser, source, buffer: new Uint8Array(analyser.fftSize) };
    });

    const tick = () => {
      const now = performance.now();
      const active = new Set<string>();

      for (const node of nodes) {
        node.analyser.getByteTimeDomainData(node.buffer);

        let sum = 0;
        for (const sample of node.buffer) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / node.buffer.length);

        if (rms > SPEAKING_THRESHOLD) lastLoudRef.current.set(node.id, now);

        const lastLoud = lastLoudRef.current.get(node.id) ?? 0;
        if (now - lastLoud < RELEASE_MS) active.add(node.id);
      }

      // Ayni kume ise state'e dokunma: her karede render tetiklenmesin.
      setSpeaking((current) => (sameSet(current, active) ? current : active));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
      for (const node of nodes) {
        node.source.disconnect();
        node.analyser.disconnect();
      }
    };
    // Bagimlilik bilerek yalnizca key: streams nesnesi her render'da yeni bir
    // referans, ona baglanmak analyser'lari her karede yeniden kurardi.
  }, [key]);

  // AudioContext'i yalnizca komponent tamamen kalkinca kapat.
  useEffect(() => {
    return () => {
      void contextRef.current?.close().catch(() => undefined);
      contextRef.current = null;
    };
  }, []);

  return speaking;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
