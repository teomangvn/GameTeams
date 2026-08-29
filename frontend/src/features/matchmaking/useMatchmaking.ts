import { useCallback, useEffect, useState } from "react";

import {
  matchmakingApi,
  type Game,
  type MatchResult,
  type MatchmakingEvent,
  type Ticket,
} from "@/api/matchmaking";
import { subscribe } from "@/lib/stompClient";

/**
 * Quick Match durumu: oyun listesi, aktif bilet ve bulunan eslesme.
 *
 * Bilet sunucudan da gelebilir (sayfa yenilendiginde kuyrukta kalmis olabilir),
 * bu yuzden acilista bir kez sorulur.
 */
export function useMatchmaking(enabled: boolean) {
  const [games, setGames] = useState<Game[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    void matchmakingApi.games().then(setGames).catch(() => undefined);
    void matchmakingApi
      .ticket()
      .then((t) => setTicket(t ?? null))
      .catch(() => undefined);
  }, [enabled]);

  // Kuyrukta gecen sure sayaci.
  useEffect(() => {
    if (!ticket) {
      setElapsed(0);
      return;
    }
    const started = new Date(ticket.createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ticket]);

  useEffect(() => {
    if (!enabled) return;
    return subscribe<MatchmakingEvent>("/user/queue/matchmaking", (event) => {
      if (event.type === "MATCH_FOUND") {
        setMatch(event.match);
        setTicket(null);
      }
    });
  }, [enabled]);

  const joinQueue = useCallback(
    async (gameId: string, partySize: number, rankId?: string | null) => {
      setError(null);
      try {
        setTicket(await matchmakingApi.joinQueue({ gameId, partySize, rankId }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kuyruğa girilemedi.");
      }
    },
    [],
  );

  const leaveQueue = useCallback(async () => {
    await matchmakingApi.leaveQueue().catch(() => undefined);
    setTicket(null);
  }, []);

  return {
    games,
    ticket,
    match,
    error,
    elapsedSeconds,
    joinQueue,
    leaveQueue,
    dismissMatch: () => setMatch(null),
  };
}
