import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type React from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { Conversation } from "@/api/friends";
import type { CallEvent, CallParty } from "@/api/voice";
import IncomingCallDialog from "@/features/voice/IncomingCallDialog";
import { useRingtone } from "@/features/voice/useRingtone";
import { useVoiceSession, type VoiceSession } from "@/features/voice/useVoiceSession";
import VoiceStage from "@/features/voice/VoiceStage";
import { publish, subscribe } from "@/lib/stompClient";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";

type VoiceSessionApi = ReturnType<typeof useVoiceSession>;

/** Cevap gelmezse arama bu surede kendiliginden biter. */
const RING_TIMEOUT_MS = 45_000;
/**
 * Karsi taraf aramadan cikinca kapatmadan once beklenen sure. Anlik bir soket
 * kopmasi katilimci listesini kisa sure bosaltabiliyor; hemen kapatmak
 * kesintiyi kalici bir kopmaya cevirirdi.
 */
const HANGUP_GRACE_MS = 5_000;

export interface OutgoingCall {
  conversationId: string;
  to: CallParty;
}

interface VoiceContextValue extends VoiceSessionApi {
  /**
   * Ses izgarasi mi sohbet mi gosterilecek. Bagli olmak ile izgarayi goruyor
   * olmak ayri durumlar: kullanici sese bagliyken metin kanalina veya baska
   * bir sayfaya gecip sonra izgaraya geri donebilmeli.
   */
  viewOpen: boolean;
  setViewOpen: (open: boolean) => void;
  /** Cevap bekleyen giden arama; karsi taraf katilinca null olur. */
  outgoingCall: OutgoingCall | null;
  /** Arkadasi sesli arar: arama alanina katilir ve karsi tarafi caldirir. */
  startCall: (conversation: Conversation) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

/**
 * Ses oturumunu ve birebir aramalari route'larin ustunde yasatir.
 *
 * Onceden oturum AppShell icindeydi: profil veya ayarlar sayfasina gecmek
 * AppShell'i kaldiriyor, ses baglantisi da onunla birlikte olup izgaraya
 * donmenin bir yolu kalmiyordu. Uzak sesler ve gelen arama penceresi de
 * burada; uygulamanin neresinde olunursa olunsun calisir.
 */
export function VoiceSessionProvider({ children }: { children: React.ReactNode }) {
  const voice = useVoiceSession();
  const [viewRequested, setViewOpen] = useState(false);
  const signedIn = useAuthStore((s) => Boolean(s.user));
  const navigate = useNavigate();
  const location = useLocation();

  const [incomingCall, setIncomingCall] = useState<{ conversationId: string; from: CallParty } | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCall | null>(null);

  const { session, connect, disconnect } = voice;
  // Baglanti yokken izgara acik sayilmaz; baglanti basarisiz olsa da bos ekran kalmaz.
  const viewOpen = viewRequested && session !== null;

  // Olay dinleyicileri guncel duruma state bagimliligi kurmadan erissin.
  const sessionRef = useRef<VoiceSession | null>(session);
  const outgoingRef = useRef<OutgoingCall | null>(outgoingCall);
  useEffect(() => {
    sessionRef.current = session;
    outgoingRef.current = outgoingCall;
  }, [session, outgoingCall]);

  /** Cevaplanmamis giden aramayi iptal eder; karsi tarafta calma durur. */
  const cancelOutgoing = useCallback(() => {
    const outgoing = outgoingRef.current;
    if (!outgoing) return;
    publish(`/app/call.${outgoing.conversationId}.cancel`, {});
    outgoingRef.current = null;
    setOutgoingCall(null);
  }, []);

  const disconnectAndClose = useCallback(() => {
    // Kimse acmadan kapatildiysa aranan kisi calmaya devam etmesin.
    cancelOutgoing();
    disconnect();
    setViewOpen(false);
  }, [cancelOutgoing, disconnect]);

  // Cikis yapilinca oturum kapanmali; provider route'lardan bagimsiz yasiyor.
  // Izgara bayragi da sifirlanmali ki ayni sekmede giren kisi bos ekrana dusmesin.
  useEffect(() => {
    if (!signedIn && session) disconnectAndClose();
  }, [signedIn, session, disconnectAndClose]);

  useEffect(() => {
    if (!signedIn) setIncomingCall(null);
  }, [signedIn]);

  const joinCall = useCallback(
    (conversationId: string, other: CallParty) => {
      setViewOpen(true);
      void connect({
        id: conversationId,
        name: other.displayName,
        roomId: null,
        roomName: "Sesli arama",
        conversationId,
      });
      // Ayri bir sayfadaysak (eski ayar/profil sayfalari) izgara gorunsun.
      if (location.pathname !== "/") navigate("/");
    },
    [connect, location.pathname, navigate],
  );

  const startCall = useCallback(
    (conversation: Conversation) => {
      // Zaten bu aramadaysak yeniden caldirma; yalnizca izgarayi ac.
      if (sessionRef.current?.conversationId === conversation.id) {
        setViewOpen(true);
        return;
      }
      cancelOutgoing();

      const to: CallParty = {
        userId: conversation.otherUserId,
        displayName: conversation.otherDisplayName,
        avatarUrl: conversation.otherAvatarUrl,
      };
      const outgoing = { conversationId: conversation.id, to };
      outgoingRef.current = outgoing;
      setOutgoingCall(outgoing);
      joinCall(conversation.id, to);
      publish(`/app/call.${conversation.id}.ring`, {});
    },
    [cancelOutgoing, joinCall],
  );

  // Arama olaylari.
  useEffect(() => {
    if (!signedIn) return;

    return subscribe<CallEvent>("/user/queue/calls", (event) => {
      switch (event.type) {
        case "RINGING":
          // Iki taraf ayni anda birbirini aradiysa ikisi de zaten ayni alanda.
          if (sessionRef.current?.conversationId === event.conversationId) return;
          setIncomingCall((current) => current ?? { conversationId: event.conversationId, from: event.user });
          return;

        case "CANCELLED":
          setIncomingCall((current) =>
            current?.conversationId === event.conversationId ? null : current,
          );
          return;

        case "DECLINED":
        case "UNAVAILABLE": {
          if (outgoingRef.current?.conversationId !== event.conversationId) return;
          outgoingRef.current = null;
          setOutgoingCall(null);
          toast.error(
            event.type === "DECLINED"
              ? `${event.user.displayName} aramayı reddetti.`
              : `${event.user.displayName} şu an çevrimdışı.`,
          );
          if (sessionRef.current?.conversationId === event.conversationId) {
            disconnect();
            setViewOpen(false);
          }
          return;
        }
      }
    });
  }, [signedIn, disconnect]);

  // Giden arama: karsi taraf katilinca cevaplandi say; oturum biterse iptal et.
  useEffect(() => {
    if (!outgoingCall) return;
    if (session?.conversationId !== outgoingCall.conversationId) {
      // Mikrofon izni reddedildi, baska kanala gecildi vb.
      cancelOutgoing();
      return;
    }
    if (session.participants.some((p) => p.userId === outgoingCall.to.userId)) {
      outgoingRef.current = null;
      setOutgoingCall(null);
    }
  }, [outgoingCall, session, cancelOutgoing]);

  // Cevap gelmezse kapat.
  useEffect(() => {
    if (!outgoingCall) return;
    const timer = setTimeout(() => {
      if (outgoingRef.current !== outgoingCall) return;
      toast.error(`${outgoingCall.to.displayName} cevap vermedi.`);
      disconnectAndClose();
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [outgoingCall, disconnectAndClose]);

  // Gelen arama, arayan vazgecmeden de zaman asimina ugrayabilir (baglanti koptu).
  useEffect(() => {
    if (!incomingCall) return;
    const timer = setTimeout(() => setIncomingCall(null), RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [incomingCall]);

  /**
   * Karsi taraf aramadan ayrildiginda aramayi bitir. Birebir aramada tek
   * basina kalmanin anlami yok; kullanici "neden hala bagliyim" diye kalirdi.
   */
  const peerSeenRef = useRef<string | null>(null);
  const callConversationId = session?.conversationId ?? null;
  const callPeerCount = session?.participants.length ?? 0;
  useEffect(() => {
    if (!callConversationId) {
      peerSeenRef.current = null;
      return;
    }
    if (callPeerCount > 0) {
      peerSeenRef.current = callConversationId;
      return;
    }
    if (peerSeenRef.current !== callConversationId) return;

    const timer = setTimeout(() => {
      toast.success("Arama sona erdi.");
      disconnectAndClose();
    }, HANGUP_GRACE_MS);
    return () => clearTimeout(timer);
  }, [callConversationId, callPeerCount, disconnectAndClose]);

  const acceptCall = useCallback(() => {
    const call = incomingCall;
    if (!call) return;
    setIncomingCall(null);
    cancelOutgoing();
    // Kabul ayri bir mesaj degil: ayni ses alanina katilmak yeterli; arayan
    // tarafta katilimci gorununce calma durur.
    joinCall(call.conversationId, call.from);
  }, [incomingCall, cancelOutgoing, joinCall]);

  const declineCall = useCallback(() => {
    const call = incomingCall;
    if (!call) return;
    publish(`/app/call.${call.conversationId}.decline`, {});
    setIncomingCall(null);
  }, [incomingCall]);

  useRingtone(incomingCall ? "incoming" : outgoingCall ? "outgoing" : null);

  return (
    <VoiceContext.Provider
      value={{
        ...voice,
        disconnect: disconnectAndClose,
        viewOpen,
        setViewOpen,
        outgoingCall,
        startCall,
      }}
    >
      {children}
      {/* Uzak ses akislari; gorunur bir yeri yok ama olmadan ses duyulmaz. */}
      <VoiceStage session={session} />
      <IncomingCallDialog
        caller={incomingCall?.from ?? null}
        onAccept={acceptCall}
        onDecline={declineCall}
      />
    </VoiceContext.Provider>
  );
}

export function useVoice(): VoiceContextValue {
  const value = useContext(VoiceContext);
  if (!value) throw new Error("useVoice VoiceSessionProvider icinde kullanilmali.");
  return value;
}

export default VoiceSessionProvider;
