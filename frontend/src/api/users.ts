import { request } from "@/api/client";
import type { AuthUser } from "@/api/auth";

export interface UpdateProfilePayload {
  displayName: string;
  bio: string;
  region: string;
  language: string;
}

export const usersApi = {
  updateProfile: (payload: UpdateProfilePayload) =>
    request<AuthUser>("/api/users/me", { method: "PATCH", body: payload }),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<AuthUser>("/api/users/me/avatar", { method: "POST", body: form });
  },

  removeAvatar: () => request<AuthUser>("/api/users/me/avatar", { method: "DELETE" }),

  /** Yeni adrese dogrulama baglantisi gonderir; adres henuz degismez. */
  requestEmailChange: (payload: { newEmail: string; password: string }) =>
    request<{ message: string }>("/api/users/me/email", { method: "POST", body: payload }),

  /** Baglantidaki token'i dogrular ve adresi uygular. Kimlik gerektirmez. */
  confirmEmailChange: (token: string) =>
    request<{ message: string }>("/api/users/email-change/confirm", {
      method: "POST",
      body: { token },
    }),
};
