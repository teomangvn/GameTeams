import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Headphones, Play, Stop, Video, VideoOff } from "@carbon/icons-react";

import {
  describeCameraError,
  describeMicrophoneError,
  isSecureMediaContext,
} from "@/features/voice/mediaErrors";
import { useVoice } from "@/features/voice/VoiceSessionProvider";
import { MicrophoneProcessor } from "@/lib/audio/microphoneProcessor";
import { cn } from "@/lib/utils";
import {
  VOICE_GATE_MAX_DB,
  VOICE_GATE_MIN_DB,
  type NoiseSuppressionMode,
  useMediaSettingsStore,
  videoConstraints,
} from "@/stores/mediaSettingsStore";

/**
 * Ses ve goruntu aygit ayarlari.
 *
 * Her aygitin yaninda kendi testi var: bir aygiti secmek ancak calistigini
 * gorebiliyorsan ise yarar. Aygit adlari yalnizca kullanici bir kez izin
 * verdikten sonra okunabilir; izin yoksa tarayici bos etiket dondurur.
 *
 * `embedded` ile uygulama icindeki ayar penceresinde, sayfa cercevesi ve
 * "Uygulamaya don" baglantisi olmadan gosterilir.
 */
export function DeviceSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const settings = useMediaSettingsStore();
  const update = useMediaSettingsStore((s) => s.set);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setDevices(await navigator.mediaDevices.enumerateDevices());
  }, []);

  useEffect(() => {
    if (!isSecureMediaContext()) {
      setPermissionError("Aygıt seçimi HTTPS gerektiriyor.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        // Izin zaten verilmisse etiketler okunur; gereksiz ikinci bir mikrofon
        // acmak ses kanalindaki mikrofonu kisa sure etkileyebiliyordu.
        const known = await navigator.mediaDevices.enumerateDevices();
        if (!known.some((device) => device.kind === "audioinput" && device.label)) {
          const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
          for (const track of probe.getTracks()) track.stop();
        }
        if (!cancelled) await refresh();
      } catch (error) {
        if (!cancelled) setPermissionError(describeMicrophoneError(error));
      }
    })();

    navigator.mediaDevices.addEventListener("devicechange", refresh);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", refresh);
    };
  }, [refresh]);

  const byKind = (kind: MediaDeviceKind) => devices.filter((d) => d.kind === kind);
  const speakerSupported =
    typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  return (
    <div className={embedded ? undefined : "min-h-screen bg-[#1a1a1a] p-4 sm:p-8"}>
      <div className={embedded ? undefined : "mx-auto max-w-2xl"}>
        {!embedded && (
          <>
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-lexend text-[13px] text-neutral-400 hover:text-neutral-200"
            >
              <ArrowLeft size={16} /> Uygulamaya dön
            </Link>

            <h1 className="font-lexend font-semibold text-[24px] text-neutral-50 mt-4">
              Ses ve görüntü
            </h1>
          </>
        )}

        {permissionError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 font-lexend text-[13px] text-amber-300 leading-relaxed"
          >
            {permissionError} Aygıt adlarını görebilmek için mikrofon izni gerekiyor.
          </div>
        )}

        <Card title="Mikrofon">
          <DeviceSelect
            label="Mikrofon"
            value={settings.microphoneId}
            devices={byKind("audioinput")}
            onChange={(microphoneId) => update({ microphoneId })}
          />
          <MicrophoneTest />
        </Card>

        <Card
          title="Mikrofon işleme"
          description="Değişiklikler ses kanalındayken de anında uygulanır. Etkisini duymak için yukarıdaki testte “Kendimi dinle”yi aç."
        >
          <div>
            <span className="block font-lexend text-[14px] text-neutral-50">Gürültü engelleme</span>
            <NoiseModeSelector
              value={settings.noiseSuppression}
              onChange={(noiseSuppression) => update({ noiseSuppression })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Toggle
              label="Ses eşiği"
              description="Sesin eşiğin altındayken mikrofon tamamen susar; konuşma aralarındaki klavye ve nefes sesleri gitmez. Eşiği testteki çubukla ayarla."
              checked={settings.voiceGate}
              onChange={(voiceGate) => update({ voiceGate })}
            />
            {settings.voiceGate && (
              <label className="block pl-12 pb-2">
                <span className="flex items-center justify-between font-lexend text-[12px] text-neutral-400 mb-1.5">
                  <span>Eşik</span>
                  <span className="tabular-nums text-neutral-200">
                    {settings.voiceGateThreshold} dB
                  </span>
                </span>
                <input
                  type="range"
                  min={VOICE_GATE_MIN_DB}
                  max={VOICE_GATE_MAX_DB}
                  step={1}
                  value={settings.voiceGateThreshold}
                  onChange={(event) => update({ voiceGateThreshold: Number(event.target.value) })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="flex justify-between font-lexend text-[11px] text-neutral-500 mt-0.5">
                  <span>Hassas</span>
                  <span>Yalnızca yüksek ses</span>
                </span>
              </label>
            )}
            <Toggle
              label="Yankı engelleme"
              description="Hoparlörden çıkan sesin mikrofona geri dönmesini önler."
              checked={settings.echoCancellation}
              onChange={(echoCancellation) => update({ echoCancellation })}
            />
            <Toggle
              label="Otomatik ses seviyesi"
              description="Sesini uzaklaştıkça yükseltir, yaklaştıkça kısar."
              checked={settings.autoGainControl}
              onChange={(autoGainControl) => update({ autoGainControl })}
            />
          </div>
        </Card>

        <Card title="Hoparlör">
          <DeviceSelect
            label="Çıkış aygıtı"
            value={settings.speakerId}
            devices={byKind("audiooutput")}
            disabled={!speakerSupported}
            onChange={(speakerId) => update({ speakerId })}
          />
          {!speakerSupported && (
            <span className="block font-lexend text-[12px] text-neutral-500 -mt-2">
              Bu tarayıcı çıkış aygıtı seçimini desteklemiyor; sistem varsayılanı kullanılır.
            </span>
          )}
          <SpeakerTest />
        </Card>

        <Card title="Kamera">
          <DeviceSelect
            label="Kamera"
            value={settings.cameraId}
            devices={byKind("videoinput")}
            onChange={(cameraId) => update({ cameraId })}
          />
          <CameraTest />
        </Card>
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 first-of-type:mt-6 rounded-2xl border border-neutral-800 bg-black p-6">
      <h2 className="font-lexend font-semibold text-[16px] text-neutral-50">{title}</h2>
      {description && (
        <p className="font-lexend text-[13px] text-neutral-400 mt-1">{description}</p>
      )}
      <div className="mt-5 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function DeviceSelect({
  label,
  value,
  devices,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  devices: MediaDeviceInfo[];
  disabled?: boolean;
  onChange: (deviceId: string) => void;
}) {
  return (
    <label className="block">
      <span className="block font-lexend text-[13px] text-neutral-300 mb-1.5">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "w-full h-10 rounded-lg bg-neutral-950 border border-neutral-800 px-3",
          "font-lexend text-[14px] text-neutral-50",
          "outline-none focus:border-neutral-600 transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <option value="">Sistem varsayılanı</option>
        {devices.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

const NOISE_MODES: Array<{ value: NoiseSuppressionMode; label: string; description: string }> = [
  {
    value: "off",
    label: "Kapalı",
    description: "Ses işlenmeden gönderilir. Sessiz bir odada veya stüdyo mikrofonunda en doğal ses.",
  },
  {
    value: "standard",
    label: "Standart",
    description: "Tarayıcının engelleyicisi. Fan ve uğultu gibi sabit gürültüyü azaltır; klavye gibi ani seslerde zayıftır.",
  },
  {
    value: "enhanced",
    label: "Gelişmiş",
    description: "Yapay zekâ (RNNoise) cihazında çalışır. Klavye, fare tıklaması, köpek, trafik gibi ani sesleri de bastırır.",
  },
];

function NoiseModeSelector({
  value,
  onChange,
}: {
  value: NoiseSuppressionMode;
  onChange: (mode: NoiseSuppressionMode) => void;
}) {
  const active = NOISE_MODES.find((mode) => mode.value === value) ?? NOISE_MODES[2];

  return (
    <div className="mt-2">
      <div
        role="radiogroup"
        aria-label="Gürültü engelleme"
        className="grid grid-cols-3 gap-1 rounded-lg bg-neutral-950 border border-neutral-800 p-1"
      >
        {NOISE_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={mode.value === value}
            onClick={() => onChange(mode.value)}
            className={cn(
              "h-8 rounded-md font-lexend text-[13px] transition-colors",
              mode.value === value
                ? "bg-emerald-500/15 text-emerald-300"
                : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100",
            )}
          >
            {mode.label}
            {mode.value === "enhanced" && mode.value !== value && (
              <span className="ml-1 text-[11px] text-emerald-400/80">önerilen</span>
            )}
          </button>
        ))}
      </div>
      <span className="block font-lexend text-[12px] text-neutral-500 leading-relaxed mt-1.5">
        {active.description}
      </span>
    </div>
  );
}

function TestButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-3 rounded-lg inline-flex items-center gap-2 self-start",
        "font-lexend text-[13px] border transition-colors",
        active
          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15"
          : "border-neutral-700 text-neutral-200 hover:bg-neutral-800",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors relative",
          checked ? "bg-emerald-500" : "bg-neutral-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-all",
            checked ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block font-lexend text-[14px] text-neutral-50">{label}</span>
        <span className="block font-lexend text-[12px] text-neutral-500 leading-relaxed">
          {description}
        </span>
      </span>
    </label>
  );
}

/* ------------------------------- Testler -------------------------------- */

/** Olcerin gosterdigi aralik (dBFS). */
const METER_MIN_DB = -80;
const METER_MAX_DB = 0;

function dbToFraction(db: number): number {
  return Math.min(1, Math.max(0, (db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)));
}

/** setSinkId henuz her tarayicida yok ve TS tipi de tanimli degil. */
type AudioElementWithSink = HTMLAudioElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

/**
 * Mikrofon testi: islenmis sesin canli seviyesi ve istege bagli kendini dinleme.
 *
 * Ses kanalindayken ayri bir mikrofon ACILMAZ; kanaldaki mikrofon olculur.
 * Ayni aygitta ikinci bir yakalama Chrome'da kanaldaki mikrofonun isleme
 * ayarlarini bozabiliyor, ayrica olculen ses tam olarak karsiya gidenle ayni
 * oluyor. Kanalda degilken test kendi mikrofonunu ayni isleme hattiyla acar.
 */
function MicrophoneTest() {
  const microphoneId = useMediaSettingsStore((s) => s.microphoneId);
  const noiseSuppression = useMediaSettingsStore((s) => s.noiseSuppression);
  const echoCancellation = useMediaSettingsStore((s) => s.echoCancellation);
  const autoGainControl = useMediaSettingsStore((s) => s.autoGainControl);
  const voiceGate = useMediaSettingsStore((s) => s.voiceGate);
  const voiceGateThreshold = useMediaSettingsStore((s) => s.voiceGateThreshold);
  const speakerId = useMediaSettingsStore((s) => s.speakerId);

  const voice = useVoice();
  const sessionMicrophone = voice.session?.microphone ?? null;
  const sessionMuted = voice.session?.muted ?? false;

  const [ownMicrophone, setOwnMicrophone] = useState<MicrophoneProcessor | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [levelDb, setLevelDb] = useState(-Infinity);

  const microphone = sessionMicrophone ?? ownMicrophone;

  // Kanalda degilken testin kendi mikrofonu.
  useEffect(() => {
    if (sessionMicrophone || !isSecureMediaContext()) return;

    let cancelled = false;
    let opened: MicrophoneProcessor | null = null;
    setFailed(null);

    void (async () => {
      try {
        opened = await MicrophoneProcessor.open(useMediaSettingsStore.getState());
        if (cancelled) {
          opened.dispose();
          return;
        }
        setOwnMicrophone(opened);
      } catch (error) {
        if (!cancelled) setFailed(describeMicrophoneError(error));
      }
    })();

    return () => {
      cancelled = true;
      // Ayni aygitta yeni ayarlarla acmadan once eskisi kapanmali.
      opened?.dispose();
      setOwnMicrophone(null);
    };
  }, [sessionMicrophone, microphoneId, noiseSuppression, echoCancellation, autoGainControl]);

  // Esik mikrofonu yeniden acmadan uygulanir.
  useEffect(() => {
    ownMicrophone?.updateGate({ voiceGate, voiceGateThreshold });
  }, [ownMicrophone, voiceGate, voiceGateThreshold]);

  // Seviye olcumu. Isleme grafi kurulamadiysa akisin kendisi olculur.
  useEffect(() => {
    if (!microphone) return;

    let context: AudioContext | null = null;
    let read = () => microphone.readInputLevelDb();

    if (microphone.readInputLevelDb() === null) {
      try {
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(microphone.stream).connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);
        read = () => {
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (const sample of buffer) sum += sample * sample;
          const rms = Math.sqrt(sum / buffer.length);
          return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
        };
      } catch {
        return;
      }
    }

    let frame = 0;
    let smoothed = -Infinity;
    const tick = () => {
      const db = read() ?? -Infinity;
      // Hizli yukselis, yavas dusus: cubuk titremesin ama tepeler kacmasin.
      smoothed = db > smoothed ? db : smoothed - 0.8;
      setLevelDb(Math.max(smoothed, METER_MIN_DB));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      void context?.close().catch(() => undefined);
    };
  }, [microphone]);

  const gateOpen = !voiceGate || levelDb >= voiceGateThreshold;
  const level = dbToFraction(levelDb);

  return (
    <div>
      <span className="block font-lexend text-[13px] text-neutral-300 mb-2">
        Mikrofon testi
      </span>

      {failed ? (
        <span className="font-lexend text-[12px] text-red-400">{failed}</span>
      ) : (
        <>
          <div className="relative h-2.5 w-full rounded-full bg-neutral-900 overflow-hidden">
            <div
              className={cn(
                "h-full transition-[width] duration-75",
                gateOpen ? "bg-emerald-500" : "bg-neutral-600",
              )}
              style={{ width: `${Math.round(level * 100)}%` }}
            />
            {voiceGate && (
              <div
                aria-hidden="true"
                className="absolute inset-y-0 w-0.5 bg-amber-400"
                style={{ left: `${dbToFraction(voiceGateThreshold) * 100}%` }}
              />
            )}
          </div>

          <span className="block font-lexend text-[12px] text-neutral-500 mt-1.5 leading-relaxed">
            {voiceGate
              ? "Konuşurken çubuk sarı çizgiyi geçmeli, sessizken altında kalmalı. Gri kısım karşıya gitmez."
              : "Konuş; çubuk hareket etmiyorsa yanlış aygıt seçili olabilir."}
          </span>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <TestButton onClick={() => setListening((value) => !value)} active={listening}>
              {listening ? <Stop size={16} /> : <Headphones size={16} />}
              {listening ? "Dinlemeyi durdur" : "Kendimi dinle"}
            </TestButton>
            <MicrophoneStatus microphone={microphone} />
          </div>

          {listening && (
            <span className="block font-lexend text-[12px] text-amber-300/90 mt-2 leading-relaxed">
              Kulaklık kullan; hoparlörden dinlersen ses mikrofona geri döner.
              {sessionMicrophone && sessionMuted && " Ses kanalında mikrofonun kapalı olduğu için sessizlik duyarsın."}
            </span>
          )}

          {listening && microphone && (
            <Loopback stream={microphone.stream} speakerId={speakerId} />
          )}
        </>
      )}
    </div>
  );
}

function MicrophoneStatus({ microphone }: { microphone: MicrophoneProcessor | null }) {
  const mode = useMediaSettingsStore((s) => s.noiseSuppression);
  if (!microphone) return null;

  if (microphone.warning) {
    return <span className="font-lexend text-[12px] text-amber-300">{microphone.warning}</span>;
  }
  if (mode === "enhanced" && microphone.enhancedActive) {
    return (
      <span className="font-lexend text-[12px] text-emerald-400">
        Gelişmiş gürültü engelleme etkin
      </span>
    );
  }
  return null;
}

/** Islenmis mikrofon sesini secili cikisa calar; karsinin duyacagini duyarsin. */
function Loopback({ stream, speakerId }: { stream: MediaStream; speakerId: string }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current as AudioElementWithSink | null;
    if (!element) return;
    element.srcObject = stream;
    if (speakerId && element.setSinkId) void element.setSinkId(speakerId).catch(() => undefined);
    void element.play().catch(() => undefined);
    return () => {
      element.pause();
      element.srcObject = null;
    };
  }, [stream, speakerId]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

/** setSinkId henuz her tarayicida yok ve AudioContext tipinde tanimli degil. */
type AudioContextWithSink = AudioContext & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

/**
 * Hoparlor testi: secili cikis aygitina kisa bir ton calar.
 *
 * Ton yumusak bir zarf ile baslayip biter; ani basla/dur klik sesi uretir.
 */
function SpeakerTest() {
  const speakerId = useMediaSettingsStore((s) => s.speakerId);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const play = () => {
    setFailed(false);
    void (async () => {
      try {
        const context = new AudioContext() as AudioContextWithSink;
        if (speakerId && context.setSinkId) {
          await context.setSinkId(speakerId).catch(() => undefined);
        }

        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(587.33, now); // re
        oscillator.frequency.setValueAtTime(880, now + 0.18); // la

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);

        oscillator.connect(gain);
        gain.connect(context.destination);

        setPlaying(true);
        oscillator.start(now);
        oscillator.stop(now + 0.62);
        oscillator.onended = () => {
          setPlaying(false);
          void context.close().catch(() => undefined);
        };
      } catch {
        setPlaying(false);
        setFailed(true);
      }
    })();
  };

  return (
    <div>
      <span className="block font-lexend text-[13px] text-neutral-300 mb-2">
        Hoparlör testi
      </span>
      <TestButton onClick={play} active={playing}>
        <Play size={16} />
        {playing ? "Çalıyor..." : "Test sesi çal"}
      </TestButton>
      <span className="block font-lexend text-[12px] text-neutral-500 mt-1.5">
        {failed
          ? "Ses çalınamadı."
          : "Kısa bir ton duyacaksın. Duymuyorsan çıkış aygıtını değiştir."}
      </span>
    </div>
  );
}

/** Kamera testi: secili kameranin canli onizlemesi. */
function CameraTest() {
  const cameraId = useMediaSettingsStore((s) => s.cameraId);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!active) return;

    let stream: MediaStream | null = null;
    let cancelled = false;
    setError(null);

    void (async () => {
      try {
        if (!isSecureMediaContext()) throw new Error("insecure-context");
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints(useMediaSettingsStore.getState()),
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(describeCameraError(caught));
          setActive(false);
        }
      }
    })();

    // Sayfadan cikildiginda kamera isigi yanik kalmasin.
    return () => {
      cancelled = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [active, cameraId]);

  return (
    <div>
      <span className="block font-lexend text-[13px] text-neutral-300 mb-2">Kamera testi</span>

      <TestButton onClick={() => setActive((value) => !value)} active={active}>
        {active ? <VideoOff size={16} /> : <Video size={16} />}
        {active ? "Kamerayı kapat" : "Kamerayı aç"}
      </TestButton>

      {active && (
        <div className="mt-3 rounded-xl overflow-hidden border border-neutral-800 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            // Kendi goruntunde ayna beklenir.
            className="w-full aspect-video object-contain scale-x-[-1]"
          />
        </div>
      )}

      {error && (
        <span className="block font-lexend text-[12px] text-red-400 mt-1.5">{error}</span>
      )}
    </div>
  );
}

export default DeviceSettingsPage;
