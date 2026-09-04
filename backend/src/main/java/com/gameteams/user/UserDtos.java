package com.gameteams.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Profil uçlarının istek gövdeleri. */
public final class UserDtos {

    private UserDtos() {
    }

    /**
     * Profil düzenleme. Kullanıcı adı ve e-posta bilerek dışarıda: ikisi de
     * kimlik ve davet akışlarında anahtar olarak kullanılıyor, değiştirilmeleri
     * ayrı bir doğrulama akışı gerektirir.
     */
    public record UpdateProfileRequest(
            @NotBlank(message = "Görünen ad zorunlu.")
            @Size(max = 64, message = "Görünen ad en fazla 64 karakter olabilir.")
            String displayName,

            @Size(max = 500, message = "Hakkında en fazla 500 karakter olabilir.")
            String bio,

            @Size(max = 64, message = "Bölge en fazla 64 karakter olabilir.")
            String region,

            @Size(max = 32, message = "Dil en fazla 32 karakter olabilir.")
            String language) {
    }

    /**
     * E-posta değişikliği. Mevcut şifre zorunlu: çalınmış bir oturumla adresin
     * değiştirilmesi hesabı tümüyle ele geçirmeye yeterdi.
     */
    public record ChangeEmailRequest(
            @NotBlank(message = "Yeni e-posta zorunlu.")
            @Email(message = "Geçerli bir e-posta gir.")
            @Size(max = 255)
            String newEmail,

            @NotBlank(message = "Mevcut şifren zorunlu.")
            String password) {
    }

    public record ConfirmEmailChangeRequest(
            @NotBlank(message = "Doğrulama anahtarı zorunlu.")
            String token) {
    }
}
