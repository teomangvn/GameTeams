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

export function onConnectionChange(listener: ConnectionListener) {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
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
 * Baglanti henuz kurulmadiysa kurulunca otomatik abone olunur.
 */
export function subscribe<T>(destination: string, onPayload: (payload: T) => void) {
  const stomp = getStompClient();
  let subscription: { unsubscribe: () => void } | null = null;
  let cancelled = false;

  const doSubscribe = () => {
    if (cancelled) return;
    subscription = stomp.subscribe(destination, (frame: IMessage) => {
      try {
        onPayload(JSON.parse(frame.body) as T);
      } catch {
        console.error("STOMP govdesi cozulemedi:", frame.body);
      }
    });
  };

  if (stomp.connected) {
    doSubscribe();
  } else {
    const off = onConnectionChange((connected) => {
      if (connected) {
        off();
        doSubscribe();
      }
    });
  }

  return () => {
    cancelled = true;
    subscription?.unsubscribe();
  };
}

export function publish(destination: string, body: unknown) {
  const stomp = getStompClient();
  if (!stomp.connected) return false;
  stomp.publish({ destination, body: JSON.stringify(body) });
  return true;
}
