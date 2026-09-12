package com.gameteams.auth;

import java.time.Duration;

import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import com.gameteams.config.GameTeamsProperties;

/**
 * Kimlik cerezleri. Sifreli giris de harici giris (Google, Facebook) de ayni
 * cerezi yazmali; iki yerde ayri kurulursa bir ayar (secure, SameSite)
 * birinde degisip digerinde unutulur.
 */
@Component
public class AuthCookies {

    static final String REFRESH_COOKIE = "gt_refresh";
    /** "Bu cihazi hatirla" isaretlendiginde yazilir; yeni cihaz kontrolunu atlatir. */
    static final String DEVICE_COOKIE = "gt_device";

    private final GameTeamsProperties.Cookie config;

    AuthCookies(GameTeamsProperties properties) {
        this.config = properties.cookie();
    }

    public ResponseCookie refresh(String value, Duration ttl) {
        return baseRefresh(value).maxAge(ttl).build();
    }

    public ResponseCookie expiredRefresh() {
        return baseRefresh("").maxAge(Duration.ZERO).build();
    }

    public ResponseCookie device(String value, Duration ttl) {
        return ResponseCookie.from(DEVICE_COOKIE, value)
                .httpOnly(true)
                .secure(config.secure())
                .sameSite(config.sameSite())
                .path("/api/auth")
                .maxAge(ttl)
                .build();
    }

    private ResponseCookie.ResponseCookieBuilder baseRefresh(String value) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                // Dev HTTP uzerinden calisir, prod HTTPS. Sabit false birakilirsa
                // prod'da cookie duz baglantida da gonderilirdi.
                .secure(config.secure())
                .sameSite(config.sameSite())
                .path("/api/auth");
    }
}
