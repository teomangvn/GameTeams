package com.gameteams.auth;

import java.util.UUID;

import com.gameteams.user.Role;
import com.gameteams.user.User;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Kimlik uçlarının istek/yanıt gövdeleri. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank(message = "Kullanıcı adı zorunlu.")
            @Size(min = 3, max = 32, message = "Kullanıcı adı 3-32 karakter olmalı.")
            @Pattern(regexp = "^[a-zA-Z0-9_.-]+$",
                    message = "Kullanıcı adı yalnızca harf, rakam, _ . - içerebilir.")
            String username,

            @NotBlank(message = "Görünen ad zorunlu.")
            @Size(max = 64, message = "Görünen ad en fazla 64 karakter olabilir.")
            String displayName,

            @NotBlank(message = "E-posta zorunlu.")
            @Email(message = "Geçerli bir e-posta gir.")
            @Size(max = 255)
            String email,

            @NotBlank(message = "Şifre zorunlu.")
            @Size(min = 8, max = 72, message = "Şifre en az 8 karakter olmalı.")
            String password) {
    }

    public record LoginRequest(
            @NotBlank(message = "E-posta zorunlu.") String email,
            @NotBlank(message = "Şifre zorunlu.") String password) {
    }

    public record VerifyEmailRequest(@NotBlank String token) {
    }

    public record EmailOnlyRequest(
            @NotBlank(message = "E-posta zorunlu.")
            @Email(message = "Geçerli bir e-posta gir.")
            String email) {
    }

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank(message = "Şifre zorunlu.")
            @Size(min = 8, max = 72, message = "Şifre en az 8 karakter olmalı.")
            String newPassword) {
    }

    public record UserResponse(
            UUID id,
            String username,
            String displayName,
            String email,
            String avatarUrl,
            String bio,
            Role role,
            boolean emailVerified,
            String region,
            String language) {

        public static UserResponse from(User user) {
            return new UserResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getDisplayName(),
                    user.getEmail(),
                    user.getAvatarUrl(),
                    user.getBio(),
                    user.getRole(),
                    user.isEmailVerified(),
                    user.getRegion(),
                    user.getLanguage());
        }
    }

    /** Refresh token gövdede dönmez; HttpOnly cookie ile taşınır. */
    public record AuthResponse(String accessToken, long expiresInSeconds, UserResponse user) {
    }

    public record MessageResponse(String message) {
    }
}
