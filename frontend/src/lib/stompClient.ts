import { Client, type IMessage } from "@stomp/stompjs";

import { getAccessToken } from "@/api/client";

/**
 * Tek STOMP baglantisi. Uygulama boyunca paylasilir; her kanal icin yeni
 * baglanti acmak yerine abonelikler bu baglanti uzerinden yonetilir.
 *
 * Token CONNECT frame'inde gonderilir (URL'de degil): URL sunucu loglarina
 * yazilir ve token oradan sizardi.
 */

// Ayni origin uzerinden: sayfa https ise wss, http ise ws.
const WS_URL =
  import.meta.env.VITE_WS_URL ??
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

let client: Client | null = null;

type ConnectionListener = (connected: boolean) => void;
const connectionListeners = new Set<ConnectionListener>();

function notify(connected: boolean) {
  for (const listener of connectionListeners) listener(connected);
}

/** Dinleyiciyi kaydeder; donen fonksiyon aboneligi kaldirir. */
export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  // Set.delete boolean doner; React efekt temizleyicisi void bekler.
  return () => {
    connectionListeners.delete(listener);
  };
}

export function getStompClient(): Client {
  if (client) return client;

  client = new Client({
    brokerURL: WS_URL,
    // Token her yeniden baglanmada tazeden okunur; sure dolmus token ile
    // sonsuz yeniden deneme dongusune girilmesin diye.
    beforeConnect: () => {
      const token = getAccessToken();
      client!.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    },
    reconnectDelay: 3000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onConnect: () => notify(true),
    onWebSocketClose: () => notify(false),
    onStompError: (frame) => {
      console.error("STOMP hatasi:", frame.headers.message, frame.body);
    },
  });

  client.activate();
  return client;
}

export function disconnectStomp() {
  if (client) {
    void client.deactivate();
    client = null;
    notify(false);
  }
}

/**
 * Hedefe abone olur, aboneligi iptal eden fonksiyonu doner.
 *
 * Abonelik baglantinin omru boyunca korunur: STOMP her yeniden baglandiginda
 * yeniden kurulur. Yalnizca ilk baglantida abone olmak yetmiyor -- ag
 * dalgalanmasi, uyku modu veya WiFi gecisi soketi kapattiginda eski abonelik
 * olu baglantiya ait kaliyor ve ses olaylari, sinyalleşme, sohbet mesajlari
 * sessizce kesiliyordu.
 */
export function subscribe<T>(destination: string, onPayload: (payload: T) => void) {
  const stomp = getStompClient();
  let subscription: { unsubscribe: () => void } | null = null;
  let cancelled = false;

  const doSubscribe = () => {
    if (cancelled || !stomp.connected) return;
    subscription = stomp.subscribe(destination, (frame: IMessage) => {
      try {
        onPayload(JSON.parse(frame.body) as T);
      } catch {
        console.error("STOMP govdesi cozulemedi:", frame.body);
      }
    });
  };

  const off = onConnectionChange((connected) => {
    if (cancelled) return;
    // Kopan baglantinin aboneligi artik gecersiz; referansi birakip
    // yeniden baglanmada sifirdan abone oluyoruz.
    subscription = null;
    if (connected) doSubscribe();
  });

  doSubscribe();

  return () => {
    cancelled = true;
    off();
    try {
      subscription?.unsubscribe();
    } catch {
      // Baglanti zaten kapalitysa unsubscribe hata firlatir; onemsiz.
    }
  };
}

export function publish(destination: string, body: unknown) {
  const stomp = getStompClient();
  if (!stomp.connected) return false;
  stomp.publish({ destination, body: JSON.stringify(body) });
  return true;
}
