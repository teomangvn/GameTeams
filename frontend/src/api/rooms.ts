import { request } from "@/api/client";

export type RoomRole = "OWNER" | "MEMBER";
export type ChannelType = "TEXT" | "VOICE";

export interface Channel {
  id: string;
  roomId: string;
  name: string;
  type: ChannelType;
  topic: string | null;
  position: number;
  userLimit: number | null;
  createdAt: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  isPublic: boolean;
  isTemporary: boolean;
  myRole: RoomRole;
  memberCount: number;
  createdAt: string;
}

export interface RoomDetail extends Omit<RoomSummary, "memberCount"> {
  ownerId: string;
  /** Yalnizca oda sahibine gonderilir. */
  inviteCode: string | null;
  maxMembers: number;
  memberCount: number;
  channels: Channel[];
}

export interface RoomMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  nickname: string | null;
  role: RoomRole;
  joinedAt: string;
  online: boolean;
}

export const roomsApi = {
  list: () => request<RoomSummary[]>("/api/rooms"),

  get: (roomId: string) => request<RoomDetail>(`/api/rooms/${roomId}`),

  create: (body: { name: string; description?: string; isPublic: boolean }) =>
    request<RoomDetail>("/api/rooms", { method: "POST", body }),

  join: (inviteCode: string) =>
    request<RoomDetail>("/api/rooms/join", { method: "POST", body: { inviteCode } }),

  leave: (roomId: string) =>
    request<void>(`/api/rooms/${roomId}/leave`, { method: "POST" }),

  remove: (roomId: string) => request<void>(`/api/rooms/${roomId}`, { method: "DELETE" }),

  members: (roomId: string) => request<RoomMember[]>(`/api/rooms/${roomId}/members`),

  regenerateInvite: (roomId: string) =>
    request<{ inviteCode: string }>(`/api/rooms/${roomId}/invite-code`, { method: "POST" }),

  channels: (roomId: string) => request<Channel[]>(`/api/rooms/${roomId}/channels`),

  createChannel: (
    roomId: string,
    body: { name: string; type: ChannelType; topic?: string; userLimit?: number },
  ) => request<Channel>(`/api/rooms/${roomId}/channels`, { method: "POST", body }),

  deleteChannel: (channelId: string) =>
    request<void>(`/api/channels/${channelId}`, { method: "DELETE" }),
};
