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
        Admin admin) {

    public record Cors(List<String> allowedOrigins) {
    }

    public record Jwt(String secret, Duration accessTokenTtl, Duration refreshTokenTtl) {
    }

    /** Dev kolaylığı için açılışta seed edilen admin. password boşsa seeder çalışmaz. */
    public record Admin(String username, String email, String password) {
    }
}
