import { useCallback, useEffect, useRef, useState } from "react";

import { voiceApi, type SignalMessage, type VoiceEvent, type VoiceParticipant } from "@/api/voice";
import { PeerManager } from "@/lib/webrtc/peerManager";
import {
  describeCameraError,
  describeMicrophoneError,
  describeScreenShareError,
  isSecureMediaContext,
} from "@/features/voice/mediaErrors";
import { publish, subscribe } from "@/lib/stompClient";
import { toast } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";

export interface VoiceSession {
  channelId: string;
  channelName: string;
  roomName: string;
  muted: boolean;
  deafened: boolean;
  screenSharing: boolean;
  cameraOn: boolean;
  participants: VoiceParticipant[];
  /** Uzak katilimcilarin ses/goruntu akislari. */
  remoteStreams: Record<string, MediaStream>;
  /** Kendi kamera/ekran onizlemesi; izgarada kendi karesinde gosterilir. */
  localVideo: MediaStream | null;
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
        cameraOn: false,
        participants: [],
        remoteStreams: {},
        localVideo: null,
      });

      let micStream: MediaStream;
      try {
        if (!isSecureMediaContext()) {
          // navigator.mediaDevices tanimsiz; cagirmak TypeError firlatirdi.
          throw new Error("insecure-context");
        }
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (error) {
        // Oturumu temizle: aksi halde kenar cubugu "Ses baglandi" gosterir ve
        // ayni kanala tekrar tiklamak erken donerek yeniden denemeyi engeller.
        channelIdRef.current = null;
        setSession(null);
        toast.error(describeMicrophoneError(error));
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
                cameraOn: event.participant.cameraOn,
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

  const pushState = useCallback(
    (muted: boolean, deafened: boolean, screenSharing: boolean, cameraOn: boolean) => {
      const channelId = channelIdRef.current;
      if (channelId) {
        publish(`/app/voice.${channelId}.state`, { muted, deafened, screenSharing, cameraOn });
      }
    },
    [],
  );

  const toggleMute = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const muted = !s.muted;
      peersRef.current?.setMicrophoneEnabled(!muted);
      pushState(muted, s.deafened, s.screenSharing, s.cameraOn);
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
      pushState(muted, deafened, s.screenSharing, s.cameraOn);
      return { ...s, deafened, muted };
    });
  }, [pushState]);

  const toggleScreenShare = useCallback(async () => {
    const peers = peersRef.current;
    if (!peers || !session) return;

    try {
      if (session.screenSharing) {
        await peers.stopVideo();
        patch({ screenSharing: false, localVideo: null });
        pushState(session.muted, session.deafened, false, session.cameraOn);
      } else {
        const stream = await peers.startScreenShare();
        // Kamera ile ekran ayni anda yayinlanmaz; PeerManager eskisini kapatir.
        patch({ screenSharing: true, cameraOn: false, localVideo: stream });
        pushState(session.muted, session.deafened, true, false);
      }
    } catch (error) {
      // Kullanici paylasim penceresini kapattiysa mesaj gosterilmez.
      const message = describeScreenShareError(error);
      if (message) toast.error(message);
    }
  }, [session, patch, pushState]);

  const toggleCamera = useCallback(async () => {
    const peers = peersRef.current;
    if (!peers || !session) return;

    try {
      if (session.cameraOn) {
        await peers.stopVideo();
        patch({ cameraOn: false, localVideo: null });
        pushState(session.muted, session.deafened, session.screenSharing, false);
      } else {
        if (!isSecureMediaContext()) throw new Error("insecure-context");
        const stream = await peers.startCamera();
        patch({ cameraOn: true, screenSharing: false, localVideo: stream });
        pushState(session.muted, session.deafened, false, true);
      }
    } catch (error) {
      toast.error(describeCameraError(error));
    }
  }, [session, patch, pushState]);

  return {
    session,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    toggleScreenShare: () => void toggleScreenShare(),
    toggleCamera: () => void toggleCamera(),
  };
}
