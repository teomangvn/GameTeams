package com.gameteams.auth.oauth;

/**
 * Harici giris tamamlanamadi. Kod, giris sayfasina sorgu parametresi olarak
 * gider ve arayuz ona gore mesaj gosterir; ic ayrinti tarayiciya sizmaz.
 */
public class OAuthLoginException extends RuntimeException {

    private final String code;

    public OAuthLoginException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
