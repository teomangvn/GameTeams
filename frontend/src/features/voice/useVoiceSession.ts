import { useCallback, useEffect, useRef, useState } from "react";

import { voiceApi, type SignalMessage, type VoiceEvent, type VoiceParticipant } from "@/api/voice";
import { PeerManager } from "@/lib/webrtc/peerManager";
import { publish, subscribe } from "@/lib/stompClient";
import { useAuthStore } from "@/stores/authStore";

export interface VoiceSession {
  channelId: string;
  channelName: string;
  roomName: string;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  participants: VoiceParticipant[];
  /** Uzak katilimcilarin ses/goruntu akislari. */
  remoteStreams: Record<string, MediaStream>;
  error: string | null;
}

/**
 * Ses oturumu: mikrofon, mesh WebRTC baglantilari ve kanal durumu.
 *
 * Uygulama kokunde tek ornek olarak yasar; kanal veya sayfa degistirmek
 * baglantiyi koparmaz.
 */
export function useVoiceSession() {
  const selfUserId = useAuthStore((s) => s.user?.id ?? null);
  const [session, setSession] = useState<VoiceSession | null>(null);

  const peersRef = useRef<PeerManager | null>(null);
  const channelIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<Array<() => void>>([]);

  const patch = useCallback((update: Partial<VoiceSession>) => {
    setSession((current) => (current ? { ...current, ...update } : current));
  }, []);

  const teardown = useCallback(() => {
    for (const off of unsubscribeRef.current) off();
    unsubscribeRef.current = [];
    peersRef.current?.closeAll();
    peersRef.current = null;
    channelIdRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    const channelId = channelIdRef.current;
    if (channelId) publish(`/app/voice.${channelId}.leave`, {});
    teardown();
    setSession(null);
  }, [teardown]);

  // Sekme kapanirken kanaldan duzgun cikilsin.
  useEffect(() => () => teardown(), [teardown]);

  const connect = useCallback(
    async (channelId: string, channelName: string, roomName: string) => {
      if (!selfUserId) return;
      if (channelIdRef.current === channelId) return;

      // Baska kanaldaysa once oradan cik.
      if (channelIdRef.current) disconnect();

      channelIdRef.current = channelId;
      setSession({
        channelId,
        channelName,
        roomName,
        muted: false,
        deafened: false,
        screenSharing: false,
        participants: [],
        remoteStreams: {},
        error: null,
      });

      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        patch({ error: "Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et." });
        return;
      }

      const { iceServers } = await voiceApi.iceServers();

      const peers = new PeerManager({
        selfUserId,
        iceServers,
        sendSignal: (message) => publish("/app/signal", message),
        onRemoteStream: (userId, stream) =>
          setSession((s) => (s ? { ...s, remoteStreams: { ...s.remoteStreams, [userId]: stream } } : s)),
        onPeerClosed: (userId) =>
          setSession((s) => {
            if (!s) return s;
            const next = { ...s.remoteStreams };
            delete next[userId];
            return { ...s, remoteStreams: next };
          }),
      });
      peers.setLocalStream(micStream);
      peersRef.current = peers;

      // Kanal olaylari
      unsubscribeRef.current.push(
        subscribe<VoiceEvent>(`/topic/voice.${channelId}`, (event) => {
          if (event.participant.userId === selfUserId) {
            if (event.type === "VOICE_STATE") {
              patch({
                muted: event.participant.muted,
                deafened: event.participant.deafened,
                screenSharing: event.participant.screenSharing,
              });
            }
            return;
          }

          setSession((s) => {
            if (!s) return s;
            const others = s.participants.filter((p) => p.userId !== event.participant.userId);
            return {
              ...s,
              participants:
                event.type === "VOICE_LEFT" ? others : [...others, event.participant],
            };
          });

          if (event.type === "VOICE_JOINED") void peers.addPeer(event.participant.userId);
          if (event.type === "VOICE_LEFT") peers.removePeer(event.participant.userId);
        }),
      );

      // Hedefli signaling
      unsubscribeRef.current.push(
        subscribe<SignalMessage>("/user/queue/signal", (message) => {
          void peers.handleSignal(message);
        }),
      );

      // Kanaldakileri al ve mevcut olanlarla baglanti kur.
      const existing = await voiceApi.participants(channelId);
      const others = existing.filter((p) => p.userId !== selfUserId);
      patch({ participants: others });
      for (const participant of others) void peers.addPeer(participant.userId);

      publish(`/app/voice.${channelId}.join`, {});
    },
    [selfUserId, disconnect, patch],
  );

  const pushState = useCallback((muted: boolean, deafened: boolean, screenSharing: boolean) => {
    const channelId = channelIdRef.current;
    if (channelId) publish(`/app/voice.${channelId}.state`, { muted, deafened, screenSharing });
  }, []);

  const toggleMute = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const muted = !s.muted;
      peersRef.current?.setMicrophoneEnabled(!muted);
      pushState(muted, s.deafened, s.screenSharing);
      return { ...s, muted };
    });
  }, [pushState]);

  const toggleDeafen = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const deafened = !s.deafened;
      // Sesi kapatmak mikrofonu da kapatir; acmak mikrofonu geri acmaz.
      const muted = deafened ? true : s.muted;
      peersRef.current?.setMicrophoneEnabled(!muted);
      pushState(muted, deafened, s.screenSharing);
      return { ...s, deafened, muted };
    });
  }, [pushState]);

  const toggleScreenShare = useCallback(async () => {
    const peers = peersRef.current;
    if (!peers || !session) return;

    try {
      if (session.screenSharing) {
        await peers.stopScreenShare();
        patch({ screenSharing: false });
        pushState(session.muted, session.deafened, false);
      } else {
        await peers.startScreenShare();
        patch({ screenSharing: true });
        pushState(session.muted, session.deafened, true);
      }
    } catch {
      // Kullanici paylasim penceresini iptal etti; hata gostermeye gerek yok.
    }
  }, [session, patch, pushState]);

  return {
    session,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    toggleScreenShare: () => void toggleScreenShare(),
  };
}
