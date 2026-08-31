import { useEffect, useRef } from "react";

import type { VoiceSession } from "@/features/voice/useVoiceSession";
import { useMediaSettingsStore } from "@/stores/mediaSettingsStore";

/**
 * Uzak akislari calan gorunmez katman.
 *
 * PeerManager baglantiyi kurar ama sesi duyurmaz; her uzak akis bir <audio>
 * elemanina baglanmadan hicbir sey duyulmaz. Goruntu VoiceGrid'de gosterilir;
 * burada yalnizca ses calinir.
 */
export function VoiceStage({ session }: { session: VoiceSession | null }) {
  const speakerId = useMediaSettingsStore((s) => s.speakerId);

  if (!session) return null;

  const entries = Object.entries(session.remoteStreams);

  return (
    <>
      {entries.map(([userId, stream]) => (
        <RemoteAudio
          key={userId}
          stream={stream}
          deafened={session.deafened}
          speakerId={speakerId}
        />
      ))}

    </>
  );
}

/** setSinkId henuz her tarayicida yok ve TS tipi de tanimli degil. */
type AudioElementWithSink = HTMLAudioElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

function RemoteAudio({
  stream,
  deafened,
  speakerId,
}: {
  stream: MediaStream;
  deafened: boolean;
  speakerId: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    // Otomatik oynatma tarayici tarafindan engellenebilir; kullanici zaten
    // kanala tiklayarak etkilesimde bulundugu icin genelde sorun cikmaz.
    void element.play().catch(() => undefined);
  }, [stream]);

  // Sagirlastirma uzak sesi susturur; mikrofon ayri yonetilir.
  useEffect(() => {
    if (ref.current) ref.current.muted = deafened;
  }, [deafened]);

  // Cikis aygitini yonlendir. Firefox ve Safari setSinkId'i desteklemiyor;
  // desteklenmiyorsa sistem varsayilani kullanilir, ses yine de calar.
  useEffect(() => {
    const element = ref.current as AudioElementWithSink | null;
    if (!element?.setSinkId || !speakerId) return;
    void element.setSinkId(speakerId).catch(() => undefined);
  }, [speakerId]);

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

export default VoiceStage;
