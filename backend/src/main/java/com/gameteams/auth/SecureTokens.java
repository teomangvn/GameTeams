package com.gameteams.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Doğrulama/sıfırlama/yenileme token'ları için rastgele değer üretimi ve
 * özetleme. Veritabanına yalnızca özet yazılır: DB sızarsa eldeki kayıtlarla
 * oturum açılamaz veya şifre sıfırlanamaz.
 */
public final class SecureTokens {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final int TOKEN_BYTES = 32;

    private SecureTokens() {
    }

    /** URL'e gömülebilir 32 baytlık rastgele token. */
    public static String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return ENCODER.encodeToString(bytes);
    }

    /** Şemadaki CHAR(64) ile uyumlu, 64 karakterlik hex SHA-256 özeti. */
    public static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        }
        catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 bulunamadı", ex);
        }
    }
}
