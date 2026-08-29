package com.gameteams.voice;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.gameteams.common.ApiException;
import com.gameteams.voice.VoiceDtos.VoiceParticipant;

/**
 * Ses kanali doluluk durumu Redis'te tutulur.
 *
 * Kalici olmasi gerekmiyor: sunucu yeniden baslarsa kimse kanalda degildir ve
 * hayalet katilimci kalmaz. Veritabani yerine Redis kullanmak, her mute/unmute
 * icin disk yazmayi da onler.
 */
@Service
public class VoiceStateService {

    private static final Logger log = LoggerFactory.getLogger(VoiceStateService.class);

    /** Kanal -> (userId, katilimci JSON) */
    private static final String CHANNEL_KEY = "voice:channel:";
    /** Kullanici -> icinde bulundugu kanal. Tek kanal kurali ve temizlik icin. */
    private static final String USER_KEY = "voice:user:";

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    VoiceStateService(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    /**
     * Kullaniciyi kanala ekler. Baska bir kanaldaysa oradan cikarilir --
     * Discord gibi ayni anda tek ses kanali.
     *
     * @return kullanicinin ayrildigi onceki kanal (varsa)
     */
    public Optional<UUID> join(UUID channelId, VoiceParticipant participant, int userLimit) {
        Optional<UUID> previous = currentChannelOf(participant.userId());
        previous.ifPresent(prev -> leave(prev, participant.userId()));

        Long size = redis.opsForHash().size(CHANNEL_KEY + channelId);
        if (size != null && size >= userLimit) {
            throw ApiException.conflict("VOICE_CHANNEL_FULL", "Ses kanali dolu.");
        }

        redis.opsForHash().put(CHANNEL_KEY + channelId,
                participant.userId().toString(), serialize(participant));
        redis.opsForValue().set(USER_KEY + participant.userId(), channelId.toString());

        return previous.filter(prev -> !prev.equals(channelId));
    }

    public void leave(UUID channelId, UUID userId) {
        redis.opsForHash().delete(CHANNEL_KEY + channelId, userId.toString());
        redis.delete(USER_KEY + userId);
    }

    /** Baglanti koptugunda cagrilir; kullanicinin hangi kanalda oldugu bilinmez. */
    public Optional<UUID> leaveCurrentChannel(UUID userId) {
        Optional<UUID> channelId = currentChannelOf(userId);
        channelId.ifPresent(id -> leave(id, userId));
        return channelId;
    }

    public Optional<UUID> currentChannelOf(UUID userId) {
        String value = redis.opsForValue().get(USER_KEY + userId);
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(UUID.fromString(value));
        }
        catch (IllegalArgumentException ex) {
            redis.delete(USER_KEY + userId);
            return Optional.empty();
        }
    }

    public Optional<VoiceParticipant> updateState(UUID channelId, UUID userId,
            boolean muted, boolean deafened, boolean screenSharing) {
        Object raw = redis.opsForHash().get(CHANNEL_KEY + channelId, userId.toString());
        if (raw == null) {
            return Optional.empty();
        }

        VoiceParticipant updated = deserialize(raw.toString())
                .withState(muted, deafened, screenSharing);
        redis.opsForHash().put(CHANNEL_KEY + channelId, userId.toString(), serialize(updated));
        return Optional.of(updated);
    }

    public Optional<VoiceParticipant> find(UUID channelId, UUID userId) {
        Object raw = redis.opsForHash().get(CHANNEL_KEY + channelId, userId.toString());
        return raw == null ? Optional.empty() : Optional.of(deserialize(raw.toString()));
    }

    public List<VoiceParticipant> participants(UUID channelId) {
        Map<Object, Object> entries = redis.opsForHash().entries(CHANNEL_KEY + channelId);
        return entries.values().stream()
                .map(value -> deserialize(value.toString()))
                .toList();
    }

    public int occupancy(UUID channelId) {
        Long size = redis.opsForHash().size(CHANNEL_KEY + channelId);
        return size == null ? 0 : size.intValue();
    }

    private String serialize(VoiceParticipant participant) {
        try {
            return objectMapper.writeValueAsString(participant);
        }
        catch (JsonProcessingException ex) {
            throw new IllegalStateException("Katilimci serilestirilemedi", ex);
        }
    }

    private VoiceParticipant deserialize(String json) {
        try {
            return objectMapper.readValue(json, VoiceParticipant.class);
        }
        catch (JsonProcessingException ex) {
            log.warn("Bozuk ses katilimci kaydi: {}", json);
            throw new IllegalStateException("Katilimci okunamadi", ex);
        }
    }
}
