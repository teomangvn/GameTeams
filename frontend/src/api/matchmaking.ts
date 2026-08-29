import { request } from "@/api/client";

export interface GameRank {
  id: string;
  name: string;
  tierOrder: number;
}

export interface Game {
  id: string;
  slug: string;
  name: string;
  iconUrl: string | null;
  minTeamSize: number;
  maxTeamSize: number;
  hasRanks: boolean;
  ranks: GameRank[];
}

export interface GameProfile {
  gameId: string;
  gameSlug: string;
  gameName: string;
  inGameName: string | null;
  rank: GameRank | null;
}

export interface Ticket {
  id: string;
  gameId: string;
  gameName: string;
  partySize: number;
  rank: GameRank | null;
  region: string | null;
  language: string | null;
  status: "QUEUED" | "MATCHED" | "CANCELLED" | "EXPIRED";
  waitingCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface MatchParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MatchResult {
  matchId: string;
  gameId: string;
  gameName: string;
  partySize: number;
  roomId: string;
  roomName: string;
  textChannelId: string;
  voiceChannelId: string;
  participants: MatchParticipant[];
  createdAt: string;
}

export type MatchmakingEvent = { type: "MATCH_FOUND"; match: MatchResult };

export const matchmakingApi = {
  games: () => request<Game[]>("/api/games"),

  profiles: () => request<GameProfile[]>("/api/me/game-profiles"),

  saveProfile: (gameId: string, body: { inGameName?: string; rankId?: string | null }) =>
    request<GameProfile>(`/api/me/game-profiles/${gameId}`, { method: "PUT", body }),

  /** Kuyrukta degilse 204 doner; istemci bunu null olarak gorur. */
  ticket: () => request<Ticket | undefined>("/api/matchmaking/ticket"),

  joinQueue: (body: {
    gameId: string;
    partySize: number;
    rankId?: string | null;
    region?: string | null;
    language?: string | null;
  }) => request<Ticket>("/api/matchmaking/queue", { method: "POST", body }),

  leaveQueue: () => request<void>("/api/matchmaking/queue", { method: "DELETE" }),
};
