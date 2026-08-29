import { request } from "@/api/client";
import type { ChatMessage } from "@/api/messages";

export interface Friend {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  since: string | null;
}

export interface FriendRequest {
  friendshipId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  otherUserId: string;
  otherUsername: string;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  otherOnline: boolean;
  lastMessage: ChatMessage | null;
  createdAt: string;
}

export type FriendEvent = {
  type: "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "FRIEND_REMOVED";
  friendshipId: string;
  user: Friend;
};

export const friendsApi = {
  list: () => request<Friend[]>("/api/friends"),
  incoming: () => request<FriendRequest[]>("/api/friends/requests/incoming"),
  outgoing: () => request<FriendRequest[]>("/api/friends/requests/outgoing"),

  sendRequest: (username: string) =>
    request<Friend>("/api/friends/requests", { method: "POST", body: { username } }),

  accept: (friendshipId: string) =>
    request<Friend>(`/api/friends/requests/${friendshipId}/accept`, { method: "POST" }),

  decline: (friendshipId: string) =>
    request<void>(`/api/friends/requests/${friendshipId}`, { method: "DELETE" }),

  remove: (userId: string) => request<void>(`/api/friends/${userId}`, { method: "DELETE" }),
};

export const dmApi = {
  list: () => request<Conversation[]>("/api/conversations"),

  open: (userId: string) =>
    request<Conversation>("/api/conversations", { method: "POST", body: { userId } }),

  history: (conversationId: string, cursor?: string | null) =>
    request<{ messages: ChatMessage[]; nextCursor: string | null }>(
      `/api/conversations/${conversationId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    ),

  send: (conversationId: string, content: string) =>
    request<ChatMessage>(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { content },
    }),
};
