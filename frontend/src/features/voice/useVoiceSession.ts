import { useCallback, useState } from "react";

/**
 * Ses oturumu durumu. Şu an yalnızca UI durumunu tutuyor; Phase 4'te aynı
 * arayüzün arkasına gerçek RTCPeerConnection yönetimi girecek ve state
 * Zustand'a taşınacak (bağlantının route değişiminde yaşaması için).
 */

export interface VoiceSession {
  channelId: string;
  channelName: string;
  roomName: string;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  pingMs: number;
}

export function useVoiceSession() {
  const [session, setSession] = useState<VoiceSession | null>(null);

  const connect = useCallback(
    (channelId: string, channelName: string, roomName: string) => {
      setSession((current) =>
        // Aynı kanaldaysa bağlantıyı koparmadan aynen bırak.
        current?.channelId === channelId
          ? current
          : {
              channelId,
              channelName,
              roomName,
              muted: false,
              deafened: false,
              screenSharing: false,
              pingMs: 28,
            },
      );
    },
    [],
  );

  const disconnect = useCallback(() => setSession(null), []);

  const toggleMute = useCallback(
    () => setSession((s) => (s ? { ...s, muted: !s.muted } : s)),
    [],
  );

  // Sesi kapatmak mikrofonu da kapatır; açmak mikrofonu geri açmaz.
  const toggleDeafen = useCallback(
    () =>
      setSession((s) =>
        s
          ? { ...s, deafened: !s.deafened, muted: !s.deafened ? true : s.muted }
          : s,
      ),
    [],
  );

  const toggleScreenShare = useCallback(
    () => setSession((s) => (s ? { ...s, screenSharing: !s.screenSharing } : s)),
    [],
  );

  return {
    session,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
  };
}
