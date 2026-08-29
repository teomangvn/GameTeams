import { useCallback, useEffect, useRef, useState } from "react";

import { dmApi } from "@/api/friends";
import { messagesApi, type ChannelEvent, type ChatMessage } from "@/api/messages";
import { publish, subscribe } from "@/lib/stompClient";

const TYPING_TIMEOUT_MS = 4000;

/** Sohbetin hedefi: bir kanal ya da bir DM konusmasi. */
export type ChatTarget =
  | { kind: "channel"; id: string }
  | { kind: "dm"; id: string }
  | null;

/**
 * Canli sohbet: gecmis + WebSocket akisi. Kanal ve DM ayni hattan beslenir,
 * yalnizca hedef ve abonelik adresi degisir.
 *
 * Mesajlar TanStack Query yerine yerel state'te tutulur; sonsuz scroll ve
 * WebSocket ekleme/guncelleme desenleri sorgu cache'inden farkli ilerliyor.
 */
export function useChat(target: ChatTarget) {
  const targetKind = target?.kind ?? null;
  const targetId = target?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const typingTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSent = useRef(0);

  // Hedef degisince gecmisi bastan yukle.
  useEffect(() => {
    if (!targetId || !targetKind) {
      setMessages([]);
      setCursor(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const load =
      targetKind === "dm" ? dmApi.history(targetId) : messagesApi.history(targetId);
    load
      .then((page) => {
        if (cancelled) return;
        setMessages(page.messages);
        setCursor(page.nextCursor);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetId, targetKind]);

  // Canli akis. Kanal olaylari topic'ten, DM'ler kisisel kuyruktan gelir.
  useEffect(() => {
    if (!targetId || !targetKind) return;

    const destination =
      targetKind === "dm" ? "/user/queue/dm" : `/topic/channel.${targetId}`;

    const unsubscribe = subscribe<ChannelEvent | ChatMessage>(destination, (payload) => {
      // DM kuyrugu ham mesaj tasir; kanal topic'i olay zarfi.
      const event: ChannelEvent =
        targetKind === "dm"
          ? { type: "MESSAGE_CREATED", message: payload as ChatMessage }
          : (payload as ChannelEvent);

      if (event.type === "TYPING") {
        setTypingUsers((prev) => ({ ...prev, [event.userId]: event.displayName }));
        clearTimeout(typingTimers.current[event.userId]);
        typingTimers.current[event.userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[event.userId];
            return next;
          });
        }, TYPING_TIMEOUT_MS);
        return;
      }

      // DM kuyrugu kullanicinin tum sohbetlerini tasir; acik olmayan bir
      // sohbetin mesaji bu listeye yazilmamali.
      if (targetKind === "dm" && event.message.conversationId !== targetId) return;

      setMessages((prev) => {
        const existing = prev.findIndex((m) => m.id === event.message.id);
        // Kendi gonderdigimiz mesaj REST yanitiyla zaten eklenmis olabilir;
        // ayni id iki kez listelenmesin.
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = event.message;
          return next;
        }
        return event.type === "MESSAGE_CREATED" ? [...prev, event.message] : prev;
      });
    });

    return () => {
      unsubscribe();
      for (const timer of Object.values(typingTimers.current)) clearTimeout(timer);
      typingTimers.current = {};
      setTypingUsers({});
    };
  }, [targetId, targetKind]);

  const loadOlder = useCallback(async () => {
    if (!targetId || !targetKind || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page =
        targetKind === "dm"
          ? await dmApi.history(targetId, cursor)
          : await messagesApi.history(targetId, cursor);
      setMessages((prev) => [...page.messages, ...prev]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [targetId, targetKind, cursor, loadingMore]);

  const send = useCallback(
    (content: string) => {
      if (!targetId || !targetKind) return;

      // DM'de STOMP ucu yok; yayin sunucu tarafinda REST'ten yapiliyor.
      if (targetKind === "dm") {
        void dmApi.send(targetId, content);
        return;
      }

      // Kanalda WebSocket acikken oradan gonderilir; degilse REST'e dusulur.
      const sent = publish(`/app/channel.${targetId}.send`, { content });
      if (!sent) void messagesApi.send(targetId, content);
    },
    [targetId, targetKind],
  );

  const notifyTyping = useCallback(() => {
    // Yaziyor bildirimi su an yalnizca kanallarda var.
    if (!targetId || targetKind !== "channel") return;
    // Her tusa basista frame gondermemek icin kisilir.
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    publish(`/app/channel.${targetId}.typing`, {});
  }, [targetId, targetKind]);

  return {
    messages,
    loading,
    loadingMore,
    hasMore: cursor !== null,
    typingUsers: Object.values(typingUsers),
    loadOlder,
    send,
    notifyTyping,
  };
}
