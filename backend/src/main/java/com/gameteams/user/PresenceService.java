package com.gameteams.user;

import java.time.Duration;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Cevrimici durumu Redis'te, TTL ile tutulur.
 *
 * TTL kritik: sunucu cokerse veya disconnect olayi kacirilirsa kullanicilar
 * sonsuza dek "cevrimici" gorunmesin. WebSocket baglantisi acik oldugu surece
 * heartbeat ile tazelenir.
 */
@Service
public class PresenceService {

    private static final String KEY = "presence:user:";
    private static final Duration TTL = Duration.ofSeconds(90);

    private final StringRedisTemplate redis;

    PresenceService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void markOnline(UUID userId) {
        redis.opsForValue().set(KEY + userId, "1", TTL);
    }

    public void markOffline(UUID userId) {
        redis.delete(KEY + userId);
    }

    public boolean isOnline(UUID userId) {
        return Boolean.TRUE.equals(redis.hasKey(KEY + userId));
    }

    /** Toplu sorgu; arkadas listesi icin tek tek sormaktan cok daha ucuz. */
    public Set<UUID> onlineAmong(Collection<UUID> userIds) {
        if (userIds.isEmpty()) {
            return Set.of();
        }
        return userIds.stream()
                .filter(this::isOnline)
                .collect(Collectors.toSet());
    }
}
