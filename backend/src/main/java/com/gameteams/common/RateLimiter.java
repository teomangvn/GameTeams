package com.gameteams.common;

import java.time.Duration;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Sabit pencereli basit sayaç. Brute-force ve mail bombardımanını yavaşlatmak
 * için yeterli; hassas kotalar gerekiyorsa kayan pencereye geçilmeli.
 */
@Component
public class RateLimiter {

    private final StringRedisTemplate redis;

    RateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Sayacı artırır ve limit aşıldıysa 429 fırlatır.
     *
     * @param key    kota anahtarı, ör. "login:203.0.113.5"
     * @param limit  pencere başına izin verilen istek sayısı
     * @param window pencere uzunluğu
     */
    public void check(String key, int limit, Duration window, String message) {
        String redisKey = "ratelimit:" + key;
        Long count = redis.opsForValue().increment(redisKey);

        if (count != null && count == 1L) {
            // İlk istekte pencereyi başlat. TTL yoksa anahtar kalıcı olur ve
            // kullanıcı sonsuza dek kilitlenirdi.
            redis.expire(redisKey, window);
        }

        if (count != null && count > limit) {
            throw ApiException.tooManyRequests("RATE_LIMITED", message);
        }
    }
}
