package com.gameteams.auth.oauth;

import java.util.Map;

import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * Saglayicidan bagimsiz kullanici bilgisi.
 *
 * @param emailTrusted saglayici bu adresin kullaniciya ait oldugunu dogruladi mi.
 *                     Mevcut bir hesaba otomatik baglama yalnizca bu durumda yapilir.
 */
public record OAuthProfile(
        String provider,
        String subject,
        String email,
        boolean emailTrusted,
        String name) {

    public static final String GOOGLE = "google";
    public static final String FACEBOOK = "facebook";

    public static OAuthProfile from(String registrationId, OAuth2User user) {
        return switch (registrationId) {
            case GOOGLE -> fromGoogle(user);
            case FACEBOOK -> fromFacebook(user.getAttributes());
            default -> throw new IllegalArgumentException("Bilinmeyen saglayici: " + registrationId);
        };
    }

    /** Google OIDC: e-postanin dogrulandigini email_verified acikca soyler. */
    private static OAuthProfile fromGoogle(OAuth2User user) {
        if (user instanceof OidcUser oidc) {
            return new OAuthProfile(GOOGLE, oidc.getSubject(), blankToNull(oidc.getEmail()),
                    Boolean.TRUE.equals(oidc.getEmailVerified()), blankToNull(oidc.getFullName()));
        }
        Map<String, Object> attributes = user.getAttributes();
        return new OAuthProfile(GOOGLE, string(attributes, "sub"), string(attributes, "email"),
                Boolean.TRUE.equals(attributes.get("email_verified")), string(attributes, "name"));
    }

    /**
     * Facebook e-postanin dogrulandigina dair bir alan dondurmuyor. Bu yuzden
     * adres yeni hesap acmak icin kullanilir ama mevcut bir hesaba otomatik
     * baglamak icin guvenilmez: aksi halde baskasinin adresini Facebook'a
     * yazan biri o hesabi ele gecirebilirdi.
     */
    private static OAuthProfile fromFacebook(Map<String, Object> attributes) {
        return new OAuthProfile(FACEBOOK, string(attributes, "id"), string(attributes, "email"),
                false, string(attributes, "name"));
    }

    private static String string(Map<String, Object> attributes, String key) {
        Object value = attributes.get(key);
        return value == null ? null : blankToNull(value.toString());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
