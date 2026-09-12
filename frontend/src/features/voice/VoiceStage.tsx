import { useCallback, useEffect, useRef, useState } from "react";
import { VolumeUp } from "@carbon/icons-react";

import type { VoiceSession } from "@/features/voice/useVoiceSession";
import { toast } from "@/stores/toastStore";
import { useMediaSettingsStore, useUserVolume } from "@/stores/mediaSettingsStore";

/**
 * Uzak akislari calan gorunmez katman.
 *
 * PeerManager baglantiyi kurar ama sesi duyurmaz; her uzak akis bir <audio>
 * elemanina baglanmadan hicbir sey duyulmaz. Goruntu VoiceGrid'de gosterilir;
 * burada yalnizca ses calinir.
 *
 * Buradaki iki hata onceden sessizce yutuluyordu ve "her sey dogru ama ses
 * gelmiyor" tablosunun en olasi sebebiydi:
 *   - play() otomatik oynatma politikasi yuzunden reddedilebilir
 *   - setSinkId secili cikis aygiti kaybolmussa reddedilir
 * Ikisi de artik kullaniciya gorunur.
 */
export function VoiceStage({ session }: { session: VoiceSession | null }) {
  const speakerId = useMediaSettingsStore((s) => s.speakerId);
  const [blockedCount, setBlockedCount] = useState(0);
  const resumeHandlers = useRef(new Map<string, () => Promise<void>>());

  const registerBlocked = useCallback((userId: string, resume: (() => Promise<void>) | null) => {
    if (resume) resumeHandlers.current.set(userId, resume);
    else resumeHandlers.current.delete(userId);
    setBlockedCount(resumeHandlers.current.size);
  }, []);

  const resumeAll = useCallback(() => {
    // Tiklama bir kullanici etkilesimi; otomatik oynatma kilidi burada acilir.
    // Yukseltme hattinin AudioContext'i de ayni kilide takiliyor olabilir.
    void playbackContext?.resume().catch(() => undefined);
    void Promise.all([...resumeHandlers.current.values()].map((resume) => resume()));
  }, []);

  if (!session) return null;

  return (
    <>
      {Object.entries(session.remoteStreams).map(([userId, stream]) => (
        <RemoteAudio
          key={userId}
          userId={userId}
          stream={stream}
          deafened={session.deafened}
          speakerId={speakerId}
          onBlockedChange={registerBlocked}
        />
      ))}

      {blockedCount > 0 && (
        <button
          type="button"
          onClick={resumeAll}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2
                     rounded-full bg-amber-500 px-4 py-2.5 font-lexend text-[14px] font-semibold
                     text-neutral-950 shadow-lg shadow-black/40 hover:bg-amber-400 transition-colors"
        >
          <VolumeUp size={18} />
          Sesi başlat — tarayıcı otomatik oynatmayı engelledi
        </button>
      )}
    </>
  );
}

/**
 * %100'un ustundeki seviyeler icin paylasilan AudioContext.
 *
 * HTMLMediaElement.volume 1'in ustune cikamiyor; yukseltme icin GainNode
 * gerekiyor. Her kullanici icin ayri context acmak tarayicinin context
 * sinirina takilir, bu yuzden tek ornek tembel olarak kurulur.
 */
let playbackContext: AudioContext | null = null;

function getPlaybackContext(): AudioContext | null {
  if (playbackContext) return playbackContext;
  try {
    playbackContext = new AudioContext();
  } catch {
    // Web Audio yoksa yukseltme yapilamaz; seviye %100'de sinirlanir.
    return null;
  }
  return playbackContext;
}

/**
 * Uzak akisi GainNode'dan gecirip calinabilir bir akis uretir.
 *
 * Kurulamazsa null doner ve cagiran dogrudan akisa geri duser (seviye %100'de
 * sinirlanir). Onceden kontrol yoktu: ses track'i olmayan bir akis (or. once
 * gelen goruntu) createMediaStreamSource'u patlatiyor, efekt hatasi tum
 * uygulamayi dusuruyordu.
 */
function createBoostPipeline(stream: MediaStream): {
  gain: GainNode;
  output: MediaStream;
  dispose: () => void;
} | null {
  if (stream.getAudioTracks().length === 0) return null;
  const context = getPlaybackContext();
  if (!context) return null;

  try {
    const source = context.createMediaStreamSource(stream);
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(destination);

    // Chrome, uzak WebRTC akisi bir medya elemanina bagli degilse Web Audio'ya
    // sessizlik veriyor. Ham akisi sessiz bir elemanda canli tutmak gerekiyor.
    const keepAlive = new Audio();
    keepAlive.muted = true;
    keepAlive.srcObject = stream;
    void keepAlive.play().catch(() => undefined);

    return {
      gain,
      output: destination.stream,
      dispose: () => {
        source.disconnect();
        gain.disconnect();
        keepAlive.pause();
        keepAlive.srcObject = null;
      },
    };
  } catch (error) {
    console.warn("Ses yukseltme hatti kurulamadi; %100 ile devam ediliyor:", error);
    return null;
  }
}

/** setSinkId henuz her tarayicida yok ve TS tipi de tanimli degil. */
type AudioElementWithSink = HTMLAudioElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

function RemoteAudio({
  userId,
  stream,
  deafened,
  speakerId,
  onBlockedChange,
}: {
  userId: string;
  stream: MediaStream;
  deafened: boolean;
  speakerId: string;
  onBlockedChange: (userId: string, resume: (() => Promise<void>) | null) => void;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const gainRef = useRef<GainNode | null>(null);
  const volume = useUserVolume(userId);
  const volumeRef = useRef(volume);

  /**
   * %100 ve alti icin dogrudan akis calinir (kanitlanmis, en dusuk gecikmeli
   * yol). Ustu icin akis GainNode'dan gecirilip elemana o baglanir; cikis yine
   * <audio> uzerinden oldugu icin setSinkId ve sagirlastirma aynen calisir.
   */
  const boost = volume > 1;

  /**
   * Seviyeyi o an kurulu hatta uygular. Hat kurulunca da cagriliyor: yeni akis
   * geldiginde (yeniden pazarlik) GainNode 1 kazancla sifirdan kuruluyor ve
   * seviye efekti tekrar calismadigi icin yukseltme sessizce kayboluyordu.
   */
  const applyVolume = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const level = volumeRef.current;
    if (gainRef.current) {
      element.volume = 1;
      gainRef.current.gain.value = level;
    } else {
      element.volume = Math.min(1, Math.max(0, level));
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const pipeline = boost ? createBoostPipeline(stream) : null;
    gainRef.current = pipeline?.gain ?? null;
    element.srcObject = pipeline?.output ?? stream;
    applyVolume();

    const context = pipeline ? playbackContext : null;

    const attempt = async () => {
      try {
        await element.play();
        // Eleman caliyor ama yukseltme hattinin context'i askidaysa yine ses
        // yok; kullaniciya "Sesi baslat" butonu gosterilmeli.
        if (context?.state === "suspended") {
          void context.resume().catch(() => undefined);
          if (context.state === "suspended") {
            onBlockedChange(userId, attempt);
            return;
          }
        }
        onBlockedChange(userId, null);
      } catch (error) {
        // Sessizce yutmak, sesin neden gelmedigini tamamen gorunmez kiliyordu.
        console.warn(`Uzak ses baslatilamadi (${userId}):`, error);
        onBlockedChange(userId, attempt);
      }
    };

    // Kilit bir kullanici etkilesimiyle acilinca butonu kaldir.
    const onContextState = () => {
      if (context?.state === "running") void attempt();
    };
    context?.addEventListener("statechange", onContextState);

    void attempt();
    return () => {
      context?.removeEventListener("statechange", onContextState);
      pipeline?.dispose();
      gainRef.current = null;
      onBlockedChange(userId, null);
    };
  }, [stream, userId, onBlockedChange, boost, applyVolume]);

  // Seviye degisimi hatti yeniden kurmaz; yalnizca kazanc veya eleman sesi.
  useEffect(() => {
    volumeRef.current = volume;
    applyVolume();
  }, [volume, applyVolume]);

  // Sagirlastirma uzak sesi susturur; mikrofon ayri yonetilir.
  useEffect(() => {
    if (ref.current) ref.current.muted = deafened;
  }, [deafened]);

  /**
   * Cikis aygitini yonlendirir.
   *
   * Secili aygit artik yoksa (kulaklik cikarilmis, USB sokulmus) setSinkId
   * reddeder. Onceden sessizce yutuluyordu ve kullanici sesi neden duymadigini
   * anlayamiyordu. Basarisizlikta varsayilan cikisa donuluyor.
   */
  useEffect(() => {
    const element = ref.current as AudioElementWithSink | null;
    if (!element?.setSinkId || !speakerId) return;

    void element.setSinkId(speakerId).catch((error: unknown) => {
      console.warn("Secili cikis aygitina yonlendirilemedi:", error);
      toast.error("Seçili hoparlör kullanılamıyor; sistem varsayılanına dönüldü.");
      void element.setSinkId("").catch(() => undefined);
    });
  }, [speakerId]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

export default VoiceStage;
