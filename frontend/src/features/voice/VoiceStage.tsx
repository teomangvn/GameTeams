import { useCallback, useEffect, useRef, useState } from "react";
import { VolumeUp } from "@carbon/icons-react";

import type { VoiceSession } from "@/features/voice/useVoiceSession";
import { toast } from "@/stores/toastStore";
import { useMediaSettingsStore } from "@/stores/mediaSettingsStore";

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

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = stream;

    const attempt = async () => {
      try {
        await element.play();
        onBlockedChange(userId, null);
      } catch (error) {
        // Sessizce yutmak, sesin neden gelmedigini tamamen gorunmez kiliyordu.
        console.warn(`Uzak ses baslatilamadi (${userId}):`, error);
        onBlockedChange(userId, attempt);
      }
    };

    void attempt();
    return () => onBlockedChange(userId, null);
  }, [stream, userId, onBlockedChange]);

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
