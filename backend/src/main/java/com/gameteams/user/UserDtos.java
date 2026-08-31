package com.gameteams.user;

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
}
