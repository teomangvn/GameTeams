import { RnnoiseWorkletNode, loadRnnoise } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

// no-inline: kucuk dosyayi data: URL olarak gommesin; AudioWorklet her
// tarayicida data: URL modulu yuklemiyor.
import voiceGateWorkletUrl from "@/lib/audio/voiceGateWorklet.js?url&no-inline";
import { audioConstraints, type MediaSettings } from "@/stores/mediaSettingsStore";

export type MicrophoneSettings = Pick<
  MediaSettings,
  | "microphoneId"
  | "noiseSuppression"
  | "echoCancellation"
  | "autoGainControl"
  | "voiceGate"
  | "voiceGateThreshold"
>;

/** RNNoise 48 kHz'a gore egitilmis; baska hizda calistirmak sesi bozar. */
const SAMPLE_RATE = 48_000;
/** Askidaki AudioContext'in acilmasi icin beklenen en uzun sure. */
const RESUME_TIMEOUT_MS = 1_500;

let rnnoiseBinary: Promise<ArrayBuffer> | null = null;

/** Wasm bir kez indirilir; basarisiz olursa sonraki denemede tekrar denenir. */
function loadRnnoiseBinary(): Promise<ArrayBuffer> {
  rnnoiseBinary ??= loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }).catch(
    (error: unknown) => {
      rnnoiseBinary = null;
      throw error;
    },
  );
  return rnnoiseBinary;
}

/** getUserMedia'yi yeniden gerektiren ayarlarin imzasi. */
function captureKey(settings: MicrophoneSettings): string {
  return [
    settings.microphoneId,
    settings.noiseSuppression,
    settings.echoCancellation,
    settings.autoGainControl,
  ].join("|");
}

async function ensureRunning(context: AudioContext): Promise<boolean> {
  if (context.state === "running") return true;
  await Promise.race([
    context.resume().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS)),
  ]);
  // resume() await edilirken durum degisir; TS ilk kontrolden daraltmis sayiyor.
  return (context.state as AudioContextState) === "running";
}

interface Graph {
  context: AudioContext;
  output: MediaStream;
  analyser: AnalyserNode;
  gate: AudioWorkletNode;
  dispose: () => void;
}

/**
 * Mikrofonu acar ve gonderilecek sesi hazirlar.
 *
 *   mikrofon -> [RNNoise] -> ses esigi -> gonderilen track
 *
 * Onceden yalnizca tarayicinin noiseSuppression kisiti vardi. O engelleyici
 * sabit ugultuyu biraz azaltiyor ama klavye, kopek, trafik gibi ani seslere
 * neredeyse hic dokunmuyor; "gurultu engelleme calismiyor" sikayetinin
 * kaynagi buydu. RNNoise cihazda calisan bir sinir agi ve bu sesleri de
 * bastiriyor.
 *
 * Isleme grafi kurulamazsa (eski tarayici, desteklenmeyen ornekleme hizi)
 * ham mikrofona ve tarayicinin engelleyicisine geri dusulur; ses asla
 * tamamen kaybolmaz. Bu durum `warning` ile bildirilir.
 */
export class MicrophoneProcessor {
  /** Karsi tarafa gonderilen, islenmis akis. */
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  /** Gelismis engelleme gercekten calisiyor mu (istenip kurulamamis olabilir). */
  readonly enhancedActive: boolean;
  /** Istenen isleme uygulanamadiysa kullaniciya gosterilecek aciklama. */
  readonly warning: string | null;
  /** Istenen aygit; bos ise sistem varsayilani. */
  readonly deviceId: string;

  private readonly raw: MediaStream;
  private readonly graph: Graph | null;
  private readonly key: string;
  private readonly levelBuffer: Float32Array<ArrayBuffer> | null;
  private disposed = false;

  private constructor(options: {
    raw: MediaStream;
    graph: Graph | null;
    key: string;
    deviceId: string;
    enhancedActive: boolean;
    warning: string | null;
  }) {
    this.raw = options.raw;
    this.graph = options.graph;
    this.key = options.key;
    this.deviceId = options.deviceId;
    this.enhancedActive = options.enhancedActive;
    this.warning = options.warning;
    this.stream = options.graph?.output ?? options.raw;
    this.track = this.stream.getAudioTracks()[0];
    this.levelBuffer = options.graph ? new Float32Array(options.graph.analyser.fftSize) : null;
  }

  static async open(settings: MicrophoneSettings): Promise<MicrophoneProcessor> {
    const key = captureKey(settings);
    const wantEnhanced = settings.noiseSuppression === "enhanced";
    let warning: string | null = null;

    // Once isleme hazirligi: RNNoise kurulamayacaksa mikrofon tarayicinin
    // engelleyicisiyle istenmeli, sonradan kisit degistirmek mumkun degil.
    let context: AudioContext | null = null;
    let rnnoise: ArrayBuffer | null = null;
    try {
      context = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
      if (!(await ensureRunning(context))) throw new Error("audio-context-suspended");
      await context.audioWorklet.addModule(voiceGateWorkletUrl);
      if (wantEnhanced) {
        try {
          const [binary] = await Promise.all([
            loadRnnoiseBinary(),
            context.audioWorklet.addModule(rnnoiseWorkletUrl),
          ]);
          rnnoise = binary;
        } catch (error) {
          console.warn("RNNoise yuklenemedi:", error);
          warning = "Gelişmiş gürültü engelleme yüklenemedi; standart engelleme kullanılıyor.";
        }
      }
    } catch (error) {
      console.warn("Mikrofon isleme grafi hazirlanamadi:", error);
      void context?.close().catch(() => undefined);
      context = null;
      if (wantEnhanced || settings.voiceGate) {
        warning = "Bu tarayıcı gelişmiş ses işlemeyi desteklemiyor; standart ayarlar kullanılıyor.";
      }
    }

    const useRnnoise = rnnoise !== null;
    const fallbackMode = settings.noiseSuppression === "off" ? "off" : "standard";

    // Hata firlatirsa (izin yok, aygit yok) cagirana aynen gider.
    let raw: MediaStream;
    try {
      raw = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints({
          ...settings,
          noiseSuppression: useRnnoise ? "enhanced" : fallbackMode,
        }),
      });
    } catch (error) {
      void context?.close().catch(() => undefined);
      throw error;
    }

    if (!context) {
      return new MicrophoneProcessor({
        raw,
        graph: null,
        key,
        deviceId: settings.microphoneId,
        enhancedActive: false,
        warning,
      });
    }

    try {
      const graph = buildGraph(context, raw, rnnoise);
      const processor = new MicrophoneProcessor({
        raw,
        graph,
        key,
        deviceId: settings.microphoneId,
        enhancedActive: useRnnoise,
        warning,
      });
      processor.updateGate(settings);
      return processor;
    } catch (error) {
      // Firefox, aygitin ornekleme hizi 48 kHz degilse burada hata verir.
      console.warn("Mikrofon isleme grafi kurulamadi:", error);
      void context.close().catch(() => undefined);

      if (useRnnoise) {
        // Mikrofon tarayici engelleyicisi kapali istendi; oyle kalirsa hic
        // engelleme olmaz. Standart engellemeyle yeniden iste.
        for (const track of raw.getTracks()) track.stop();
        raw = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints({ ...settings, noiseSuppression: fallbackMode }),
        });
      }
      return new MicrophoneProcessor({
        raw,
        graph: null,
        key,
        deviceId: settings.microphoneId,
        enhancedActive: false,
        warning:
          wantEnhanced || settings.voiceGate
            ? "Bu mikrofonda gelişmiş ses işleme çalışmadı; standart ayarlar kullanılıyor."
            : null,
      });
    }
  }

  /** Bu ayarlar yeni bir mikrofon acmadan uygulanabilir mi. */
  matches(settings: MicrophoneSettings): boolean {
    return this.key === captureKey(settings);
  }

  /** Ses esigini canli gunceller; mikrofon yeniden acilmaz, konusma kesilmez. */
  updateGate(settings: Pick<MicrophoneSettings, "voiceGate" | "voiceGateThreshold">) {
    if (!this.graph) return;
    const now = this.graph.context.currentTime;
    this.graph.gate.parameters.get("enabled")?.setValueAtTime(settings.voiceGate ? 1 : 0, now);
    this.graph.gate.parameters.get("threshold")?.setValueAtTime(settings.voiceGateThreshold, now);
  }

  /**
   * Esikten onceki anlik seviye (dBFS). Ayarlar sayfasindaki olcer bunu
   * kullanir: esigin altindaki sesi de gostermeli ki esik ayarlanabilsin.
   * Isleme grafi yoksa null.
   */
  readInputLevelDb(): number | null {
    if (!this.graph || !this.levelBuffer) return null;
    this.graph.analyser.getFloatTimeDomainData(this.levelBuffer);
    let sum = 0;
    for (const sample of this.levelBuffer) sum += sample * sample;
    const rms = Math.sqrt(sum / this.levelBuffer.length);
    return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const track of this.raw.getTracks()) track.stop();
    this.graph?.dispose();
  }
}

function buildGraph(
  context: AudioContext,
  raw: MediaStream,
  rnnoiseBinary: ArrayBuffer | null,
): Graph {
  const source = context.createMediaStreamSource(raw);

  const rnnoise = rnnoiseBinary
    ? new RnnoiseWorkletNode(context, { wasmBinary: rnnoiseBinary, maxChannels: 1 })
    : null;

  const gate = new AudioWorkletNode(context, "gameteams-voice-gate", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 1,
    channelCountMode: "explicit",
    outputChannelCount: [1],
  });

  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;

  const destination = context.createMediaStreamDestination();
  destination.channelCount = 1;

  const denoised: AudioNode = rnnoise ?? source;
  if (rnnoise) source.connect(rnnoise);
  denoised.connect(gate);
  denoised.connect(analyser);
  gate.connect(destination);

  // Sekme arka plana gecince veya ses aygiti degisince context askiya
  // alinabilir; askida kalirsa karsi tarafa sessizlik gider.
  const onStateChange = () => {
    if (context.state === "suspended") void context.resume().catch(() => undefined);
  };
  context.addEventListener("statechange", onStateChange);

  return {
    context,
    output: destination.stream,
    analyser,
    gate,
    dispose: () => {
      context.removeEventListener("statechange", onStateChange);
      source.disconnect();
      rnnoise?.disconnect();
      rnnoise?.destroy();
      gate.disconnect();
      analyser.disconnect();
      for (const track of destination.stream.getTracks()) track.stop();
      void context.close().catch(() => undefined);
    },
  };
}
