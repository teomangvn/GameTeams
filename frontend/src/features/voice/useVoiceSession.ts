import { useCallback, useEffect, useRef, useState } from "react";

import { voiceApi, type SignalMessage, type VoiceEvent, type VoiceParticipant } from "@/api/voice";
import { PeerManager } from "@/lib/webrtc/peerManager";
import {
  describeCameraError,
  describeMicrophoneError,
  describeScreenShareError,
  isSecureMediaContext,
} from "@/features/voice/mediaErrors";
import { onConnectionChange, publish, subscribe } from "@/lib/stompClient";
import { toast } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";
import {
  audioConstraints,
  useMediaSettingsStore,
  videoConstraints,
} from "@/stores/mediaSettingsStore";

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
  /** Kendi onizlemeleri; izgarada kendi karelerinde gosterilir. */
  localCamera: MediaStream | null;
  localScreen: MediaStream | null;
  /** Kendi mikrofon akisi; konusma gostergesi bunun seviyesini olcer. */
  localAudio: MediaStream | null;
}

/**
 * Ses oturumu: mikrofon, mesh WebRTC baglantilari ve kanal durumu.
 *
 * Uygulama kokunde tek ornek olarak yasar; kanal veya sayfa degistirmek
 * baglantiyi koparmaz.
 */
/** Katilimci listesinin sunucuyla esitlenme araligi. */
const RECONCILE_INTERVAL_MS = 10_000;

/** Katilimin islendigini dogrulamak icin deneme sayisi ve araligi. */
const REGISTRATION_ATTEMPTS = 12;
const REGISTRATION_DELAY_MS = 250;

/** Kanala katilma istegi sunucuya ulasmadi ve kayit dogrulanamadi. */
export class JoinFailedError extends Error {
  constructor() {
    super("voice-join-failed");
    this.name = "JoinFailedError";
  }
}

/**
 * Kanala katilir ve sunucunun kaydi isledigini dogrular.
 *
 * join bir STOMP yayini: onay dondurmuyor ve soket kapaliysa publish sessizce
 * false donuyor. Katilimci listesinde kendimizi gormek, kaydin gercekten
 * islendigini kanitlayan tek dogrudan sinyal.
 *
 * Dogrulanamazsa HATA firlatilir. Onceden sessizce devam ediliyordu: arayuz
 * "ses baglandi" gosterirken sunucu bizi kanalda saymiyor, gonderdigimiz her
 * teklif ve ICE adayi reddediliyordu. Kullaniciya calisiyormus gibi gorunen
 * bir baglanti, acikca basarisiz olandan cok daha kotu.
 */
async function joinAndConfirm(
  channelId: string,
  selfUserId: string,
): Promise<VoiceParticipant[]> {
  for (let attempt = 0; attempt < REGISTRATION_ATTEMPTS; attempt++) {
    // Her turda yeniden yayinla: ilk denemede soket henuz baglanmamis olabilir
    // ve publish sessizce dusurulur.
    publish(`/app/voice.${channelId}.join`, {});

    await new Promise((resolve) => setTimeout(resolve, REGISTRATION_DELAY_MS));

    try {
      const latest = await voiceApi.participants(channelId);
      if (latest.some((p) => p.userId === selfUserId)) {
        return latest.filter((p) => p.userId !== selfUserId);
      }
    } catch {
      // Gecici hata; bir sonraki turda tekrar denenir.
    }
  }

  throw new JoinFailedError();
}

export function useVoiceSession() {
  const selfUserId = useAuthStore((s) => s.user?.id ?? null);
  const [session, setSession] = useState<VoiceSession | null>(null);

  const peersRef = useRef<PeerManager | null>(null);
  const channelIdRef = useRef<string | null>(null);
  const unsubscribeRef = useRef<Array<() => void>>([]);
  /** Mikrofonun hangi ayarlarla kuruldugu; gereksiz yeniden kurmayi onler. */
  const appliedAudioRef = useRef<string | null>(null);
  /** Efektlerin guncel oturuma erisebilmesi icin; state'e bagimlilik kurmadan. */
  const sessionRef = useRef<VoiceSession | null>(null);
  /** Baglanti bir kez koptu mu; ilk baglantida yeniden katilma yapilmasin. */
  const wasDisconnectedRef = useRef(false);
  /**
   * pushState asagida tanimlandigi icin ref uzerinden erisiliyor; efekt onu
   * bagimlilik olarak alsaydi her durum degisiminde yeniden kurulurdu.
   */
  const pushStateRef = useRef<
    ((muted: boolean, deafened: boolean, screenSharing: boolean, cameraOn: boolean) => void) | null
  >(null);

  const microphoneId = useMediaSettingsStore((s) => s.microphoneId);
  const noiseSuppression = useMediaSettingsStore((s) => s.noiseSuppression);
  const echoCancellation = useMediaSettingsStore((s) => s.echoCancellation);
  const autoGainControl = useMediaSettingsStore((s) => s.autoGainControl);

  const patch = useCallback((update: Partial<VoiceSession>) => {
    setSession((current) => (current ? { ...current, ...update } : current));
  }, []);

  const teardown = useCallback(() => {
    for (const off of unsubscribeRef.current) off();
    unsubscribeRef.current = [];
    peersRef.current?.closeAll();
    peersRef.current = null;
    channelIdRef.current = null;
    appliedAudioRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    const channelId = channelIdRef.current;
    if (channelId) publish(`/app/voice.${channelId}.leave`, {});
    teardown();
    setSession(null);
  }, [teardown]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Sekme kapanirken kanaldan duzgun cikilsin.
  useEffect(() => () => teardown(), [teardown]);

  /**
   * Soket yeniden baglandiginda ses kanalina tekrar katil.
   *
   * Baglanti koptugunda sunucu kullaniciyi kanaldan dusuruyor (hayalet
   * katilimci kalmasin diye) ama istemci tekrar katilmiyordu: arayuz "ses
   * baglandi" gostermeye devam ederken sunucu tarafinda kanalda kimse yoktu
   * ve sinyalleşme reddediliyordu. Ses bir kez gelip sonra kalici olarak
   * kesilmesinin sebebi buydu.
   */
  useEffect(() => {
    return onConnectionChange((connected) => {
      if (!connected) {
        wasDisconnectedRef.current = true;
        return;
      }
      // Ilk baglanti connect() tarafindan zaten yonetiliyor.
      if (!wasDisconnectedRef.current) return;
      wasDisconnectedRef.current = false;

      const peers = peersRef.current;
      const channelId = channelIdRef.current;
      if (!peers || !channelId || !selfUserId) return;

      void (async () => {
        // Karsi taraf peer'i zaten kapatmis olur; tek tarafli kalanlari temizle.
        peers.closePeers();

        let others: VoiceParticipant[];
        try {
          others = await joinAndConfirm(channelId, selfUserId);
        } catch {
          toast.error("Ses kanalina yeniden baglanilamadi.");
          return;
        }
        if (channelIdRef.current !== channelId) return;

        patch({ participants: others });
        for (const participant of others) void peers.addPeer(participant.userId);

        // Sunucudaki kayit sifirlandi; sustur/kamera durumunu yeniden bildir.
        const current = sessionRef.current;
        if (current) {
          pushStateRef.current?.(current.muted, current.deafened,
            current.screenSharing, current.cameraOn);
        }
      })();
    });
  }, [selfUserId, patch]);

  /**
   * Katilimci listesini duzenli olarak sunucudan tazeler ve eksik peer'lari kurar.
   *
   * WebRTC kurulumu VOICE_JOINED olayina baglı; olay kaybolursa o cift hic
   * baglanmiyor ve kendini toparlamiyordu. REST listesi otorite oldugu icin
   * bu esitleme kayip olaylari da telafi eder.
   */
  useEffect(() => {
    const channelId = session?.channelId;
    if (!channelId || !selfUserId) return;

    const interval = setInterval(() => {
      void (async () => {
        const peers = peersRef.current;
        // Bu arada baska kanala gecilmis olabilir.
        if (!peers || channelIdRef.current !== channelId) return;

        try {
          const current = await voiceApi.participants(channelId);
          const others = current.filter((p) => p.userId !== selfUserId);
          patch({ participants: others });
          await peers.reconcile(others.map((p) => p.userId));
        } catch {
          // Gecici hata; bir sonraki turda tekrar denenir.
        }
      })();
    }, RECONCILE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session?.channelId, selfUserId, patch]);

  /**
   * Aygit veya isleme ayari degisince canli baglantidaki mikrofonu degistir.
   * replaceTrack yeniden pazarlik gerektirmedigi icin konusma kesilmez.
   */
  useEffect(() => {
    const peers = peersRef.current;
    if (!peers || !channelIdRef.current) return;

    const settings = useMediaSettingsStore.getState();
    const signature = audioSignature(settings);
    if (appliedAudioRef.current === signature) return;
    appliedAudioRef.current = signature;

    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints(settings),
        });
        const [track] = stream.getAudioTracks();
        if (cancelled) {
          track.stop();
          return;
        }
        await peers.replaceAudioTrack(track);
        patch({ localAudio: stream });
      } catch (error) {
        toast.error(describeMicrophoneError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [microphoneId, noiseSuppression, echoCancellation, autoGainControl, patch]);

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
        localCamera: null,
        localScreen: null,
        localAudio: null,
      });

      let micStream: MediaStream;
      try {
        if (!isSecureMediaContext()) {
          // navigator.mediaDevices tanimsiz; cagirmak TypeError firlatirdi.
          throw new Error("insecure-context");
        }
        const settings = useMediaSettingsStore.getState();
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints(settings),
        });
        // Asagidaki efekt ayni ayarlar icin mikrofonu bir daha kurmasin.
        appliedAudioRef.current = audioSignature(settings);
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
          setSession((s) => (s ? { ...s, remoteStreams: mergeStream(s.remoteStreams, userId, stream) } : s)),
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
      patch({ localAudio: micStream });

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

      // Sunucu hatalari. Bu kuyruga kimse abone degildi ve sinyal redleri
      // sessizce kayboluyordu -- sesin neden kurulmadigi hicbir yerde
      // gorunmuyordu. Artik en azindan konsola dusuyor.
      unsubscribeRef.current.push(
        subscribe<{ code: string; message: string }>("/user/queue/errors", (error) => {
          console.error(`Ses sunucusu hatasi [${error.code}]: ${error.message}`);
        }),
      );

      // Hedefli signaling
      unsubscribeRef.current.push(
        subscribe<SignalMessage>("/user/queue/signal", (message) => {
          // Yakalanmayan bir reddi sessizce kaybolmasin: sinyalleşme hatasi
          // sesin neden kurulmadigini anlamanin tek ipucu olabiliyor.
          void peers.handleSignal(message).catch((error: unknown) => {
            console.error("Sinyal islenemedi:", error);
          });
        }),
      );

      // ONCE katil, SONRA teklif gonder.
      //
      // Sunucunun signal ucu gonderenin ses kanalinda olmasini sart kosuyor ve
      // aksi halde teklifi sessizce reddediyor. Katilmadan once teklif
      // gondermek, teklifi bizim vermemiz gereken (kucuk UUID) her cifti
      // sessizce kurulmamis birakiyordu -- baglanti UUID sirasina gore rastgele
      // calisiyor gibi gorunuyordu.
      let others: VoiceParticipant[];
      try {
        others = await joinAndConfirm(channelId, selfUserId);
      } catch {
        // Kayit dogrulanamadi: sahte bir "bagli" durumu birakmak yerine
        // oturumu kapat ve kullaniciya soyle.
        teardown();
        setSession(null);
        toast.error("Ses kanalina baglanilamadi. Baglantini kontrol edip tekrar dene.");
        return;
      }
      if (channelIdRef.current !== channelId) return;

      patch({ participants: others });
      for (const participant of others) void peers.addPeer(participant.userId);
    },
    [selfUserId, disconnect, patch],
  );

  const pushState = useCallback(
    (muted: boolean, deafened: boolean, screenSharing: boolean, cameraOn: boolean) => {
      const channelId = channelIdRef.current;
      if (!channelId) return;

      // Track kimlikleri PeerManager'dan okunur: alici taraf tek akistaki iki
      // video track'ini ancak bunlarla ayirt edebiliyor.
      publish(`/app/voice.${channelId}.state`, {
        muted,
        deafened,
        screenSharing,
        cameraOn,
        cameraTrackId: peersRef.current?.cameraTrackId ?? null,
        screenTrackId: peersRef.current?.screenTrackId ?? null,
      });
    },
    [],
  );

  useEffect(() => {
    pushStateRef.current = pushState;
  }, [pushState]);

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
        await peers.stopScreenShare();
        patch({ screenSharing: false, localScreen: null });
        pushState(session.muted, session.deafened, false, session.cameraOn);
      } else {
        const stream = await peers.startScreenShare();
        // Kamerayi etkilemez; ikisi ayni anda yayinlanabilir.
        patch({ screenSharing: true, localScreen: stream });
        pushState(session.muted, session.deafened, true, session.cameraOn);
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
        await peers.stopCamera();
        patch({ cameraOn: false, localCamera: null });
        pushState(session.muted, session.deafened, session.screenSharing, false);
      } else {
        if (!isSecureMediaContext()) throw new Error("insecure-context");
        const stream = await peers.startCamera(
          videoConstraints(useMediaSettingsStore.getState()),
        );
        patch({ cameraOn: true, localCamera: stream });
        pushState(session.muted, session.deafened, session.screenSharing, true);
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

/**
 * Gelen akisi kullanicinin mevcut akisiyla birlestirir.
 *
 * Kullanici basina tek akis tutuluyor. Karsi taraf sesi ve goruntuyu ayri
 * akislarda gonderirse dogrudan atama ses akisinin uzerine yazar ve kamera
 * acildiginda ses kesilir. Gonderen taraf artik tek akis kullaniyor ama
 * dagitim sirasinda eski istemciler hala ayri gonderebilir; track'leri
 * birlestirmek bu gecis penceresini de guvenli kilar.
 */
function mergeStream(
  current: Record<string, MediaStream>,
  userId: string,
  incoming: MediaStream,
): Record<string, MediaStream> {
  const existing = current[userId];

  // Ayni akis ya da ilk akis: dogrudan yerlestir.
  if (!existing || existing.id === incoming.id) {
    return { ...current, [userId]: incoming };
  }

  const known = new Set(existing.getTracks().map((track) => track.id));
  const added = incoming.getTracks().filter((track) => !known.has(track.id));
  if (added.length === 0) {
    return current;
  }

  // Yeni MediaStream: React'in degisikligi gormesi icin kimlik degismeli.
  return { ...current, [userId]: new MediaStream([...existing.getTracks(), ...added]) };
}

/** Mikrofonun yeniden kurulmasini gerektiren ayarlarin imzasi. */
function audioSignature(settings: {
  microphoneId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}): string {
  return [
    settings.microphoneId,
    settings.noiseSuppression,
    settings.echoCancellation,
    settings.autoGainControl,
  ].join("|");
}
