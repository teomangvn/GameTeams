import { request } from "@/api/client";
import type { Role } from "@/api/auth";

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  disabled: boolean;
  disabledReason: string | null;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  disabledUsers: number;
  totalRooms: number;
  temporaryRooms: number;
  totalMessages: number;
  queuedTickets: number;
}

export interface AdminRoom {
  id: string;
  name: string;
  slug: string;
  ownerUsername: string;
  isPublic: boolean;
  isTemporary: boolean;
  memberCount: number;
  createdAt: string;
}

export const adminApi = {
  stats: () => request<AdminStats>("/api/admin/stats"),

  users: (query: string, page = 0) =>
    request<{ users: AdminUser[]; page: number; size: number; total: number }>(
      `/api/admin/users?page=${page}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
    ),

  disable: (userId: string, reason: string) =>
    request<AdminUser>(`/api/admin/users/${userId}/disable`, {
      method: "POST",
      body: { reason },
    }),

  enable: (userId: string) =>
    request<AdminUser>(`/api/admin/users/${userId}/enable`, { method: "POST" }),

  rooms: () => request<AdminRoom[]>("/api/admin/rooms"),

  deleteRoom: (roomId: string) =>
    request<void>(`/api/admin/rooms/${roomId}`, { method: "DELETE" }),
};
