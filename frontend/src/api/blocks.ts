import { request } from "@/api/client";

export interface BlockedUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export const blocksApi = {
  /** Engellediklerim. Beni kimin engelledigi sunucu tarafindan bilerek verilmez. */
  list: () => request<BlockedUser[]>("/api/blocks"),

  block: (userId: string) => request<void>(`/api/blocks/${userId}`, { method: "PUT" }),

  unblock: (userId: string) => request<void>(`/api/blocks/${userId}`, { method: "DELETE" }),
};
