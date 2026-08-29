package com.gameteams.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.gameteams.config.GameTeamsProperties;
import com.gameteams.user.Role;
import com.gameteams.user.User;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final GameTeamsProperties properties;

    JwtService(GameTeamsProperties properties) {
        this.properties = properties;
        String secret = properties.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException(
                    "JWT_SECRET en az 32 byte olmalı. Üretmek için: openssl rand -base64 48");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("username", user.getUsername())
                .claim("role", user.getRole().name())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.jwt().accessTokenTtl())))
                .signWith(key)
                .compact();
    }

    /** İmza veya süre geçersizse boş döner; sebebi yalnızca loglanır. */
    public Optional<AccessTokenClaims> parseAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            return Optional.of(new AccessTokenClaims(
                    UUID.fromString(claims.getSubject()),
                    claims.get("username", String.class),
                    Role.valueOf(claims.get("role", String.class))));
        }
        catch (JwtException | IllegalArgumentException ex) {
            log.debug("Geçersiz access token: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    public record AccessTokenClaims(UUID userId, String username, Role role) {
    }
}
