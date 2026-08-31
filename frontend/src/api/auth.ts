import { request, setAccessToken } from "@/api/client";

export type Role = "USER" | "ADMIN";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
  emailVerified: boolean;
  region: string | null;
  language: string | null;
}

interface AuthResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUser;
}

interface MessageResponse {
  message: string;
}

export const authApi = {
  register: (body: {
    username: string;
    displayName: string;
    email: string;
    password: string;
  }) => request<MessageResponse>("/api/auth/register", { method: "POST", body }),

  verifyEmail: (token: string) =>
    request<MessageResponse>("/api/auth/verify-email", { method: "POST", body: { token } }),

  resendVerification: (email: string) =>
    request<MessageResponse>("/api/auth/resend-verification", {
      method: "POST",
      body: { email },
    }),

  login: async (body: { email: string; password: string }) => {
    const data = await request<AuthResponse>("/api/auth/login", { method: "POST", body });
    setAccessToken(data.accessToken);
    return data;
  },

  /** Sayfa açılışında oturumu geri getirir; cookie yoksa hata fırlatır. */
  refresh: async () => {
    const data = await request<AuthResponse>("/api/auth/refresh", { method: "POST" });
    setAccessToken(data.accessToken);
    return data;
  },

  logout: async () => {
    try {
      await request<MessageResponse>("/api/auth/logout", { method: "POST" });
    } finally {
      // Sunucu hata verse de yerel oturum kapatılmalı.
      setAccessToken(null);
    }
  },

  forgotPassword: (email: string) =>
    request<MessageResponse>("/api/auth/forgot-password", { method: "POST", body: { email } }),

  resetPassword: (token: string, newPassword: string) =>
    request<MessageResponse>("/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
    }),

  me: () => request<AuthUser>("/api/auth/me"),
};
