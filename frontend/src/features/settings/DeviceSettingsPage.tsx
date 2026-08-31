import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Video, VideoOff } from "@carbon/icons-react";

import {
  describeCameraError,
  describeMicrophoneError,
  isSecureMediaContext,
} from "@/features/voice/mediaErrors";
import { cn } from "@/lib/utils";
import {
  audioConstraints,
  useMediaSettingsStore,
  videoConstraints,
} from "@/stores/mediaSettingsStore";

/**
 * Ses ve goruntu aygit ayarlari.
 *
 * Her aygitin yaninda kendi testi var: bir aygiti secmek ancak calistigini
 * gorebiliyorsan ise yarar. Aygit adlari yalnizca kullanici bir kez izin
 * verdikten sonra okunabilir; izin yoksa tarayici bos etiket dondurur.
 */
export function DeviceSettingsPage() {
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
        // Yalnizca etiketleri acmak icin: akis hemen kapatilir.
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of probe.getTracks()) track.stop();
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
    <div className="min-h-screen bg-[#1a1a1a] p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-lexend text-[13px] text-neutral-400 hover:text-neutral-200"
        >
          <ArrowLeft size={16} /> Uygulamaya dön
        </Link>

        <h1 className="font-lexend font-semibold text-[24px] text-neutral-50 mt-4">
          Ses ve görüntü
        </h1>

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

        <Card
          title="Mikrofon işleme"
          description="Değişiklikler ses kanalındayken de anında uygulanır."
        >
          <div className="flex flex-col gap-1">
            <Toggle
              label="Gürültü engelleme"
              description="Klavye, fan ve ortam uğultusunu bastırır."
              checked={settings.noiseSuppression}
              onChange={(noiseSuppression) => update({ noiseSuppression })}
            />
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

/**
 * Mikrofon testi: secili aygitin canli seviyesi. Sessiz duran bir cubuk
 * yanlis aygiti hemen ele verir.
 */
function MicrophoneTest() {
  const microphoneId = useMediaSettingsStore((s) => s.microphoneId);
  const noiseSuppression = useMediaSettingsStore((s) => s.noiseSuppression);
  const echoCancellation = useMediaSettingsStore((s) => s.echoCancellation);
  const autoGainControl = useMediaSettingsStore((s) => s.autoGainControl);

  const [level, setLevel] = useState(0);
  const [failed, setFailed] = useState(false);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!isSecureMediaContext()) return;

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let cancelled = false;
    setFailed(false);

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints(useMediaSettingsStore.getState()),
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(stream).connect(analyser);

        const buffer = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (const sample of buffer) {
            const centered = (sample - 128) / 128;
            sum += centered * centered;
          }
          // 0..1 araligina yay; konusma tipik olarak 0.05-0.3 RMS uretir.
          setLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 4));
          frameRef.current = requestAnimationFrame(tick);
        };
        frameRef.current = requestAnimationFrame(tick);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      for (const track of stream?.getTracks() ?? []) track.stop();
      void context?.close().catch(() => undefined);
    };
  }, [microphoneId, noiseSuppression, echoCancellation, autoGainControl]);

  return (
    <div>
      <span className="block font-lexend text-[13px] text-neutral-300 mb-2">
        Mikrofon testi
      </span>
      {failed ? (
        <span className="font-lexend text-[12px] text-neutral-500">Mikrofona erişilemedi.</span>
      ) : (
        <>
          <div className="h-2 w-full rounded-full bg-neutral-900 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-75"
              style={{ width: `${Math.round(level * 100)}%` }}
            />
          </div>
          <span className="block font-lexend text-[12px] text-neutral-500 mt-1.5">
            Konuş; çubuk hareket etmiyorsa yanlış aygıt seçili olabilir.
          </span>
        </>
      )}
    </div>
  );
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
