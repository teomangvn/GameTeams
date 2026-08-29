package com.gameteams.voice;

import java.util.List;
import java.util.UUID;

public final class VoiceDtos {

    private VoiceDtos() {
    }

    /** Ses kanalindaki bir kullanicinin anlik durumu. */
    public record VoiceParticipant(
            UUID userId,
            String username,
            String displayName,
            String avatarUrl,
            boolean muted,
            boolean deafened,
            boolean screenSharing) {

        public VoiceParticipant withState(boolean muted, boolean deafened, boolean screenSharing) {
            return new VoiceParticipant(userId, username, displayName, avatarUrl,
                    muted, deafened, screenSharing);
        }
    }

    public record VoiceStateRequest(boolean muted, boolean deafened, boolean screenSharing) {
    }

    /** /topic/voice.{channelId} uzerinden yayinlanan olaylar. */
    public record VoiceEvent(String type, UUID channelId, VoiceParticipant participant) {

        public static VoiceEvent joined(UUID channelId, VoiceParticipant p) {
            return new VoiceEvent("VOICE_JOINED", channelId, p);
        }

        public static VoiceEvent left(UUID channelId, VoiceParticipant p) {
            return new VoiceEvent("VOICE_LEFT", channelId, p);
        }

        public static VoiceEvent stateChanged(UUID channelId, VoiceParticipant p) {
            return new VoiceEvent("VOICE_STATE", channelId, p);
        }
    }

    /**
     * WebRTC signaling zarfi. Sunucu icerigi yorumlamaz, yalnizca hedef
     * kullaniciya iletir.
     */
    public record SignalMessage(
            UUID targetUserId,
            UUID fromUserId,
            UUID channelId,
            /** offer | answer | ice-candidate */
            String type,
            Object payload) {
    }

    public record IceServer(List<String> urls, String username, String credential) {
    }

    public record IceServersResponse(List<IceServer> iceServers) {
    }
}
