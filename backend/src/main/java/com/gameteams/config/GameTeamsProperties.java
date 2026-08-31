package com.gameteams.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yml içindeki "gameteams" bloğunun tip güvenli karşılığı.
 */
@ConfigurationProperties(prefix = "gameteams")
public record GameTeamsProperties(
        String appUrl,
        String mailFrom,
        Cors cors,
        Jwt jwt,
        Admin admin,
        Webrtc webrtc,
        Cookie cookie,
        Uploads uploads) {

    public record Cors(List<String> allowedOrigins) {
    }

    /**
     * Avatar dosyalari diske yazilir; tek EC2 uzerinde calistigi icin nesne
     * deposu yerine bir docker volume yeterli. maxBytes hem burada hem
     * spring.servlet.multipart tarafinda sinirlanir.
     */
    public record Uploads(String avatarDir, long maxAvatarBytes) {
    }

    public record Jwt(String secret, Duration accessTokenTtl, Duration refreshTokenTtl) {
    }

    /** Dev kolaylığı için açılışta seed edilen admin. password boşsa seeder çalışmaz. */
    public record Admin(String username, String email, String password) {
    }

    /**
     * Refresh token cookie'si. secure=true yalnızca HTTPS üzerinden gönderilir;
     * dev'de HTTP kullanıldığı için kapalı, prod'da açık olmalıdır.
     */
    public record Cookie(boolean secure, String sameSite) {
    }

    /**
     * ICE sunucuları. STUN çoğu ağda yeter; symmetric NAT arkasındaki
     * kullanıcılar için TURN relay şart (turnSecret boşsa TURN kapalıdır).
     */
    public record Webrtc(
            List<String> stunUrls,
            List<String> turnUrls,
            String turnSecret,
            Duration turnCredentialTtl) {
    }
}
