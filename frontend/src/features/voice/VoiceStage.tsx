import { useEffect, useRef } from "react";

import type { VoiceSession } from "@/features/voice/useVoiceSession";

/**
 * Uzak akislari calan gorunmez katman.
 *
 * PeerManager baglantiyi kurar ama sesi duyurmaz; her uzak akis bir <audio>
 * elemanina baglanmadan hicbir sey duyulmaz. Ekran paylasimi varsa video
 * ayrica gosterilir.
 */
export function VoiceStage({ session }: { session: VoiceSession | null }) {
  if (!session) return null;

  const entries = Object.entries(session.remoteStreams);
  const screenShares = entries.filter(([, stream]) => stream.getVideoTracks().length > 0);

  return (
    <>
      {entries.map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} deafened={session.deafened} />
      ))}

      {screenShares.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex gap-3">
          {screenShares.map(([userId, stream]) => {
            const participant = session.participants.find((p) => p.userId === userId);
            return (
              <figure
                key={userId}
                className="w-72 rounded-xl overflow-hidden border border-neutral-800 bg-black shadow-xl"
              >
                <RemoteVideo stream={stream} />
                <figcaption className="px-3 py-2 font-lexend text-[12px] text-neutral-300">
                  {participant?.displayName ?? "Bilinmeyen"} ekranını paylaşıyor
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}
    </>
  );
}

function RemoteAudio({ stream, deafened }: { stream: MediaStream; deafened: boolean }) {
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

  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

function RemoteVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => undefined);
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted className="w-full aspect-video bg-black" />;
}

export default VoiceStage;
